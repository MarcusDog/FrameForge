package studio.frameforge;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import static studio.frameforge.Models.*;

@Service
@Transactional(propagation=Propagation.REQUIRES_NEW)
public class TaskStageService {
    private final TaskMapper tasks;
    public TaskStageService(TaskMapper tasks) { this.tasks=tasks; }
    public boolean claim(String id) { return tasks.claim(id)==1; }
    public boolean begin(String id,Stage stage) {
        TaskRow row=tasks.lock(id);
        if(row==null || row.status()!=Status.RUNNING) return false;
        List<StageRow> stages=tasks.stages(id);
        if(stage.ordinal()>0 && !"SUCCEEDED".equals(stages.get(stage.ordinal()-1).status())) return false;
        if(tasks.startStage(id,stage)!=1) return false;
        tasks.current(id,stage);
        return true;
    }
    public boolean complete(String id,Stage stage,String resultPath) {
        TaskRow row=tasks.lock(id);
        if(row==null || row.status()!=Status.RUNNING || row.currentStage()!=stage) return false;
        if((stage==Stage.ORGANIZING)!=(resultPath!=null)) throw new IllegalArgumentException("Only the final stage may publish a result");
        if(tasks.endStage(id,stage,"SUCCEEDED",null)!=1) return false;
        tasks.advance(id,resultPath);
        return true;
    }
    public void fail(String id,String code,String message) {
        TaskRow row=tasks.lock(id);
        if(row==null || row.status().terminal()) return;
        if(row.currentStage()!=null) tasks.endStage(id,row.currentStage(),"FAILED",message);
        tasks.skipPending(id);
        tasks.fail(id,code,message);
    }
}
