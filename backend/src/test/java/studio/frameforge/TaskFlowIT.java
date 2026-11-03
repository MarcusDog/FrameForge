package studio.frameforge;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.util.LinkedMultiValueMap;
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.time.Duration;
import java.util.*;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static studio.frameforge.Models.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.sql.init.mode=always","spring.sql.init.schema-locations=file:../database/001-schema.sql",
    "spring.sql.init.data-locations=file:../database/002-seed.sql","frameforge.queue-capacity=1",
    "frameforge.storage=./target/it-storage"
})
class TaskFlowIT {
    @Autowired TestRestTemplate http;
    @Autowired TaskService service;
    @Autowired TaskMapper mapper;
    @Autowired TaskStageService stages;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired ThreadPoolTaskExecutor executor;
    @MockitoSpyBean StageDelay delay;
    @BeforeEach void realDelay() throws Exception { doCallRealMethod().when(delay).pause(anyInt()); }
    String key(){return UUID.randomUUID().toString();}
    byte[] png() throws IOException {
        var image=new BufferedImage(100,100,BufferedImage.TYPE_INT_RGB);
        var g=image.createGraphics();g.setColor(Color.MAGENTA);g.fillRect(0,0,100,100);g.dispose();
        var out=new ByteArrayOutputStream();ImageIO.write(image,"png",out);return out.toByteArray();
    }
    HttpHeaders headers(String user){
        var headers=new HttpHeaders();headers.add(HttpHeaders.COOKIE,"ff_demo_user="+user);return headers;
    }
    <T> ResponseEntity<T> get(String path,String user,Class<T> type){
        return http.exchange(path,HttpMethod.GET,new HttpEntity<>(headers(user)),type);
    }
    String upload(String user) throws IOException {
        var body=new LinkedMultiValueMap<String,Object>();
        var fileHeaders=new HttpHeaders();fileHeaders.setContentType(MediaType.IMAGE_PNG);
        body.add("file",new HttpEntity<>(new ByteArrayResource(png()){@Override public String getFilename(){return "photo.png";}},fileHeaders));
        var h=headers(user);h.setContentType(MediaType.MULTIPART_FORM_DATA);
        var response=http.postForEntity("/api/assets",new HttpEntity<>(body,h),AssetView.class);
        assertEquals(HttpStatus.OK,response.getStatusCode());return response.getBody().id();
    }
    TaskRequest request(String asset,String key,Stage fail,int generationMs){
        return new TaskRequest("pet-portrait",List.of(asset),key,new Simulation(fail,0,generationMs,0));
    }
    ResponseEntity<Accepted> submit(TaskRequest request){
        return http.postForEntity("/api/tasks",new HttpEntity<>(request,headers("alice")),Accepted.class);
    }
    TaskView terminal(String id){
        return assertTimeoutPreemptively(Duration.ofSeconds(12),()->{
            while(true){
                var task=service.detail("alice",id);
                if(task.status().terminal())return task;
                Thread.sleep(20);
            }
        });
    }
    @Test void actualDatabaseWorkflowProducesReadablePngAndImmutableTerminalState() throws Exception {
        var response=submit(request(upload("alice"),key(),null,0));
        assertEquals(HttpStatus.ACCEPTED,response.getStatusCode());
        TaskView task=terminal(response.getBody().taskId());
        assertEquals(Status.SUCCEEDED,task.status());
        assertEquals(List.of("SUCCEEDED","SUCCEEDED","SUCCEEDED"),task.stages().stream().map(StageRow::status).toList());
        for(int i=0;i<3;i++){
            var stage=task.stages().get(i);
            assertNotNull(stage.startedAt());assertNotNull(stage.endedAt());assertTrue(stage.durationMs()>=0);
            if(i>0)assertFalse(stage.startedAt().isBefore(task.stages().get(i-1).endedAt()));
        }
        var result=get(task.resultUrl(),"alice",byte[].class);
        assertEquals(HttpStatus.OK,result.getStatusCode());
        assertEquals(1200,ImageIO.read(new ByteArrayInputStream(result.getBody())).getWidth());
        assertFalse(stages.begin(task.id(),Stage.MATERIAL_CHECK));
        assertFalse(stages.complete(task.id(),Stage.GENERATING,null));
        stages.fail(task.id(),"LATE","late");
        assertEquals(task.version(),service.detail("alice",task.id()).version());
        assertEquals(Status.SUCCEEDED,service.detail("alice",task.id()).status());
    }
    @ParameterizedTest @EnumSource(Stage.class)
    void eachInjectedFailureIsPersistentAndSkipsFollowingStages(Stage fail) throws Exception {
        var accepted=submit(request(upload("alice"),key(),fail,0)).getBody();
        var task=terminal(accepted.taskId());
        assertEquals(Status.FAILED,task.status());assertEquals(fail,task.currentStage());
        assertEquals("SIMULATED_FAILURE",task.errorCode());
        for(int i=0;i<3;i++){
            var stage=task.stages().get(i);
            assertEquals(i<fail.ordinal()?"SUCCEEDED":i==fail.ordinal()?"FAILED":"SKIPPED",stage.status());
            if(i>fail.ordinal())assertNull(stage.startedAt());
        }
        assertNull(task.resultUrl());
        assertEquals(HttpStatus.NOT_FOUND,get("/api/tasks/"+task.id()+"/result","alice",String.class).getStatusCode());
    }
    @Test void acceptanceReturnsBeforeWorkerFinishesAndQueueRejectionIsWritten() throws Exception {
        CountDownLatch started=new CountDownLatch(1),release=new CountDownLatch(1);
        doAnswer(invocation->{if((int)invocation.getArgument(0)==27000){started.countDown();assertTrue(release.await(8,TimeUnit.SECONDS));}return null;}).when(delay).pause(anyInt());
        String asset=upload("alice");
        String first=null,second=null;
        try{
            var accepted=assertTimeoutPreemptively(Duration.ofSeconds(5),()->submit(request(asset,key(),null,27000)));
            assertEquals(HttpStatus.ACCEPTED,accepted.getStatusCode());first=accepted.getBody().taskId();
            assertTrue(started.await(5,TimeUnit.SECONDS));
            assertEquals(Status.RUNNING,service.detail("alice",first).status());
            second=submit(request(asset,key(),null,0)).getBody().taskId();
            assertEquals(Status.QUEUED,service.detail("alice",second).status());
            var rejected=submit(request(asset,key(),null,0)).getBody();
            assertEquals(Status.FAILED,rejected.task().status());
            assertEquals("EXECUTOR_SATURATED",service.detail("alice",rejected.taskId()).errorCode());
            assertTrue(service.detail("alice",rejected.taskId()).stages().stream().allMatch(stage->stage.status().equals("SKIPPED")));
        }finally{release.countDown();if(first!=null)terminal(first);if(second!=null)terminal(second);}
    }
    @Test void rollbackDoesNotDispatchAndAfterCommitRecordsAreVisibleToWorker() throws Exception {
        String asset=upload("alice");var rolledBack=new AtomicReference<String>();
        var tx=new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status->{
            try{rolledBack.set(service.create("alice",request(asset,key(),null,0)));}
            catch(IOException e){throw new UncheckedIOException(e);}
            status.setRollbackOnly();
        });
        assertNull(mapper.get(rolledBack.get()));
        var accepted=submit(request(asset,key(),null,0)).getBody();
        assertEquals(Status.SUCCEEDED,terminal(accepted.taskId()).status());
    }
    @Test void sameSubmissionKeyIsIdempotentUnderConcurrentRequestsAndConflictsAreRejected() throws Exception {
        String asset=upload("alice"),key=key();
        var request=request(asset,key,null,0);
        var first=CompletableFuture.supplyAsync(()->submit(request));
        var second=CompletableFuture.supplyAsync(()->submit(request));
        var a=first.get(10,TimeUnit.SECONDS);var b=second.get(10,TimeUnit.SECONDS);
        assertEquals(HttpStatus.ACCEPTED,a.getStatusCode());assertEquals(HttpStatus.ACCEPTED,b.getStatusCode());
        assertEquals(a.getBody().taskId(),b.getBody().taskId());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM task WHERE user_id='alice' AND request_key=?",Integer.class,key));
        assertEquals(3,service.detail("alice",a.getBody().taskId()).stages().size());
        var conflict=http.postForEntity("/api/tasks",new HttpEntity<>(request(asset,key,null,1),headers("alice")),String.class);
        assertEquals(HttpStatus.CONFLICT,conflict.getStatusCode());
        terminal(a.getBody().taskId());
    }
    @Test void userIsolationCoversAssetSubmissionHistoryTaskAndResult() throws Exception {
        String asset=upload("alice"),bobAsset=upload("bob");
        var accepted=submit(request(asset,key(),null,0)).getBody();terminal(accepted.taskId());
        assertEquals(HttpStatus.NOT_FOUND,get("/api/assets/"+asset+"/content","bob",String.class).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND,get("/api/tasks/"+accepted.taskId(),"bob",String.class).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND,get("/api/tasks/"+accepted.taskId()+"/result","bob",String.class).getStatusCode());
        assertTrue(service.history("bob",false,null,20).items().stream().noneMatch(task->task.id().equals(accepted.taskId())));
        var cross=submit(request(bobAsset,key(),null,0));
        assertEquals(HttpStatus.NOT_FOUND,cross.getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED,http.getForEntity("/api/tasks",String.class).getStatusCode());
    }
    @Test void malformedCountAndImageNeverCreateValidTasks() throws Exception {
        int before=jdbc.queryForObject("SELECT COUNT(*) FROM task",Integer.class);
        var invalid=new TaskRequest("pet-portrait",List.of("missing","extra"),key(),null);
        assertEquals(HttpStatus.BAD_REQUEST,http.postForEntity("/api/tasks",new HttpEntity<>(invalid,headers("alice")),String.class).getStatusCode());
        var form=new LinkedMultiValueMap<String,Object>();
        var part=new HttpHeaders();part.setContentType(MediaType.IMAGE_PNG);
        form.add("file",new HttpEntity<>(new ByteArrayResource("not png".getBytes()){@Override public String getFilename(){return "fake.png";}},part));
        var h=headers("alice");h.setContentType(MediaType.MULTIPART_FORM_DATA);
        assertEquals(HttpStatus.BAD_REQUEST,http.postForEntity("/api/assets",new HttpEntity<>(form,h),String.class).getStatusCode());
        assertEquals(before,jdbc.queryForObject("SELECT COUNT(*) FROM task",Integer.class));
    }
    @Test void restartSettlementFailsStaleQueuedAndRunningJobsWithoutResuming() throws Exception {
        String queued=key(),running=key();
        for(String id:List.of(queued,running)){
            mapper.insert(new TaskRow(0,id,"alice","pet-portrait",Status.QUEUED,null,null,null,null,key(),"0".repeat(64),0,0,0,null,0,null,null));
            for(Stage stage:Stage.values())mapper.addStage(id,stage);
        }
        assertTrue(stages.claim(running));assertTrue(stages.begin(running,Stage.MATERIAL_CHECK));
        new TaskDispatcher().settleInterruptedTasks(mapper,stages).run(new org.springframework.boot.DefaultApplicationArguments(new String[0]));
        assertEquals("SERVER_RESTARTED",service.detail("alice",queued).errorCode());
        assertTrue(service.detail("alice",queued).stages().stream().allMatch(stage->stage.status().equals("SKIPPED")));
        var task=service.detail("alice",running);
        assertEquals(Status.FAILED,task.status());
        assertEquals(List.of("FAILED","SKIPPED","SKIPPED"),task.stages().stream().map(StageRow::status).toList());
        assertFalse(stages.claim(queued));assertFalse(stages.claim(running));
    }
    @Test void seedTextRemainsUtf8AndHistoryPaginationDoesNotLoseRecords() throws Exception {
        assertEquals("旅行明信片",service.template("travel-postcard").title());
        String asset=upload("alice");
        var first=submit(request(asset,key(),null,0)).getBody();terminal(first.taskId());
        var second=submit(request(asset,key(),null,0)).getBody();terminal(second.taskId());
        var page=service.history("alice",false,null,1);
        assertEquals(second.taskId(),page.items().getFirst().id());assertNotNull(page.nextCursor());
        assertEquals(first.taskId(),service.history("alice",false,page.nextCursor(),1).items().getFirst().id());
    }
    @Test void malformedHttpRequestsRetainTheirClientErrorStatus() {
        var method=http.exchange("/api/templates",HttpMethod.DELETE,HttpEntity.EMPTY,String.class);
        assertEquals(HttpStatus.METHOD_NOT_ALLOWED,method.getStatusCode());
        assertTrue(method.getHeaders().getAllow().contains(HttpMethod.GET));
        assertTrue(method.getBody().contains("HTTP_405"));
        var type=new HttpHeaders();type.setContentType(MediaType.TEXT_PLAIN);
        var media=http.postForEntity("/api/tasks",new HttpEntity<>("invalid",type),String.class);
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE,media.getStatusCode());
        assertTrue(media.getBody().contains("HTTP_415"));
        var missing=http.getForEntity("/api/not-an-api",String.class);
        assertEquals(HttpStatus.NOT_FOUND,missing.getStatusCode());
        assertTrue(missing.getBody().contains("HTTP_404"));
    }
}
