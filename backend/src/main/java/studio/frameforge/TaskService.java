package studio.frameforge;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.security.*;
import java.util.*;
import static studio.frameforge.Models.*;

@Service
public class TaskService {
    private final TaskMapper tasks;
    private final StoreMapper store;
    private final FileStore files;
    private final ApplicationEventPublisher events;
    private final ObjectMapper json;
    private final boolean simulationEnabled;
    public TaskService(TaskMapper tasks,StoreMapper store,FileStore files,ApplicationEventPublisher events,
                       ObjectMapper json,@Value("${frameforge.simulation-enabled}") boolean simulationEnabled) {
        this.tasks=tasks;this.store=store;this.files=files;this.events=events;this.json=json;this.simulationEnabled=simulationEnabled;
    }
    public Template template(String id) {
        Template template=store.template(id);
        if(template==null) throw ApiException.missing();
        return template;
    }
    @Transactional
    public String create(String user,TaskRequest request) throws IOException {
        Template template=template(request.templateId());
        if(request.assetIds().size()!=template.requiredImageCount() ||
           new HashSet<>(request.assetIds()).size()!=request.assetIds().size())
            throw ApiException.invalid("请按模板要求上传数量正确且不重复的图片");
        for(String id:request.assetIds()) {
            Asset asset=store.asset(id,user);
            if(asset==null) throw ApiException.missing();
            if(!template.acceptedMimeTypes().contains(asset.mimeType()) || asset.sizeBytes()>template.maxFileSizeBytes())
                throw ApiException.invalid("素材不符合模板要求");
            if(!files.exists(asset.path())) throw ApiException.invalid("素材文件已不存在，请重新上传");
        }
        Simulation s=request.simulation();
        if(!simulationEnabled && s!=null) throw ApiException.invalid("演示控制已关闭");
        int check=duration(s==null?null:s.checkMs(),1000);
        int generate=duration(s==null?null:s.generationMs(),4000);
        int organize=duration(s==null?null:s.organizeMs(),1000);
        Stage fail=s==null?null:s.failAt();
        String payload=json.writeValueAsString(Arrays.asList(template.id(),request.assetIds(),check,generate,organize,fail));
        String hash;
        try { hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
        String id=UUID.randomUUID().toString();
        tasks.insert(new TaskRow(0,id,user,template.id(),Status.QUEUED,null,null,null,null,request.requestKey(),hash,check,generate,organize,fail,0,null,null));
        TaskRow stored=tasks.byKey(user,request.requestKey());
        if(!stored.payloadHash().equals(hash)) throw new ApiException(409,"SUBMISSION_CONFLICT","提交键已用于不同参数，请重新发起制作");
        if(stored.id().equals(id)) {
            for(int i=0;i<request.assetIds().size();i++) tasks.attach(id,request.assetIds().get(i),i);
            for(Stage stage:Stage.values()) tasks.addStage(id,stage);
            events.publishEvent(new TaskCreated(id));
        }
        return stored.id();
    }
    private static int duration(Integer value,int fallback) {
        int result=value==null?fallback:value;
        if(result<0 || result>30000) throw ApiException.invalid("每个阶段耗时须为 0～30000 毫秒");
        return result;
    }
    @Transactional(readOnly=true)
    public TaskView detail(String user,String id) {
        TaskRow task=owned(user,id);
        return view(task);
    }
    public TaskRow owned(String user,String id) {
        TaskRow task=tasks.owned(id,user);
        if(task==null) throw ApiException.missing();
        return task;
    }
    @Transactional(readOnly=true)
    public TaskPage history(String user,boolean active,Long before,int limit) {
        if(limit<1 || limit>50) throw ApiException.invalid("分页数量须为 1～50");
        // Active tasks are bounded by the executor capacity and returned without history truncation.
        List<TaskRow> rows=tasks.list(user,active,before==null?Long.MAX_VALUE:before,active?10000:limit);
        Long cursor=!active && rows.size()==limit?rows.getLast().seq():null;
        return new TaskPage(rows.stream().map(this::view).toList(),cursor);
    }
    private TaskView view(TaskRow task) {
        Template template=template(task.templateId());
        return new TaskView(task.id(),task.templateId(),template.title(),template.coverUrl(),task.status(),
            task.currentStage(),task.status()==Status.SUCCEEDED?"/api/tasks/"+task.id()+"/result":null,
            task.errorCode(),task.errorMessage(),task.version(),task.createdAt(),task.updatedAt(),
            tasks.stages(task.id()),store.taskAssets(task.id()).stream().map(Asset::view).toList());
    }
}
