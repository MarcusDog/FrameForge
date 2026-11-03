package studio.frameforge;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InOrder;
import java.awt.image.BufferedImage;
import java.time.Instant;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static studio.frameforge.Models.*;

class TaskWorkerTest {
    TaskMapper tasks=mock(TaskMapper.class);
    StoreMapper store=mock(StoreMapper.class);
    TaskStageService stages=mock(TaskStageService.class);
    FileStore files=mock(FileStore.class);
    CollageRenderer renderer=mock(CollageRenderer.class);
    StageDelay delay=mock(StageDelay.class);
    TaskWorker worker=new TaskWorker(tasks,store,stages,files,renderer,delay);
    Template template=new Template("t","Test","Creative","Test",1,"/demo/test.png","postcard");
    Asset asset=new Asset("a","alice","uploads/a.png","image/png",50,10,10,Instant.now());
    TaskRow row(Stage fail) { return new TaskRow(1,"id","alice","t",Status.RUNNING,null,null,null,null,"key","hash",0,0,0,fail,1,Instant.now(),Instant.now()); }
    @BeforeEach void prepare() throws Exception {
        when(stages.claim("id")).thenReturn(true);
        when(tasks.get("id")).thenReturn(row(null));
        when(store.taskAssets("id")).thenReturn(List.of(asset));
        when(store.template("t")).thenReturn(template);
        when(stages.begin(eq("id"),any())).thenReturn(true);
        when(stages.complete(eq("id"),any(),nullable(String.class))).thenReturn(true);
        when(renderer.render(template,List.of(asset))).thenReturn(new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB));
        when(files.publish(eq("id"),any())).thenReturn("results/id.png");
    }
    @Test void stagesAreStrictlyOrdered() throws Exception {
        worker.run("id");
        InOrder order=inOrder(stages,files,renderer);
        order.verify(stages).claim("id");
        order.verify(stages).begin("id",Stage.MATERIAL_CHECK);
        order.verify(files).verify(asset);
        order.verify(stages).complete("id",Stage.MATERIAL_CHECK,null);
        order.verify(stages).begin("id",Stage.GENERATING);
        order.verify(renderer).render(template,List.of(asset));
        order.verify(stages).complete("id",Stage.GENERATING,null);
        order.verify(stages).begin("id",Stage.ORGANIZING);
        order.verify(files).publish(eq("id"),any());
        order.verify(stages).complete("id",Stage.ORGANIZING,"results/id.png");
        verify(stages,never()).fail(any(),any(),any());
    }
    @ParameterizedTest @EnumSource(Stage.class)
    void eachFailureStopsAllFollowingStages(Stage fail) throws Exception {
        when(tasks.get("id")).thenReturn(row(fail));
        worker.run("id");
        verify(stages).fail(eq("id"),eq("SIMULATED_FAILURE"),contains(fail.name()));
        verify(stages,never()).complete(eq("id"),eq(fail),nullable(String.class));
        for(Stage stage:Stage.values()) if(stage.ordinal()>fail.ordinal()) verify(stages,never()).begin("id",stage);
        if(fail!=Stage.ORGANIZING) verify(files,never()).publish(any(),any());
    }
    @Test void duplicateOrTerminalJobDoesNotExecute() {
        when(stages.claim("id")).thenReturn(false);
        worker.run("id");
        verify(stages,never()).begin(any(),any());
        verifyNoInteractions(delay);
    }
    @Test void realImageErrorIsPersistedAndStopsOrganizing() throws Exception {
        when(renderer.render(any(),any())).thenThrow(new java.io.IOException("private/path"));
        worker.run("id");
        verify(stages).fail(eq("id"),eq("STAGE_EXECUTION_ERROR"),argThat(message -> !message.contains("private/path")));
        verify(stages,never()).begin("id",Stage.ORGANIZING);
    }
    @Test void terminalRowsCannotBeChangedByStageService() {
        TaskMapper mapper=mock(TaskMapper.class);
        when(mapper.lock("id")).thenReturn(new TaskRow(1,"id","alice","t",Status.SUCCEEDED,Stage.ORGANIZING,"result",null,null,"k","h",0,0,0,null,8,Instant.now(),Instant.now()));
        TaskStageService service=new TaskStageService(mapper);
        assertFalse(service.begin("id",Stage.MATERIAL_CHECK));
        assertFalse(service.complete("id",Stage.GENERATING,null));
        service.fail("id","LATE","late");
        verify(mapper,never()).fail(any(),any(),any());
        verify(mapper,never()).advance(any(),any());
    }
    @Test void onlyOrganizingCanPublishTheFinalResult() {
        TaskMapper mapper=mock(TaskMapper.class);
        when(mapper.lock("id")).thenReturn(new TaskRow(1,"id","alice","t",Status.RUNNING,Stage.GENERATING,null,null,null,"k","h",0,0,0,null,4,Instant.now(),Instant.now()));
        assertThrows(IllegalArgumentException.class,()->new TaskStageService(mapper).complete("id",Stage.GENERATING,"premature.png"));
        verify(mapper,never()).advance(any(),any());
        verify(mapper,never()).endStage(any(),any(),any(),any());
    }
}
