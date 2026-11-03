package studio.frameforge;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import java.awt.image.BufferedImage;
import static studio.frameforge.Models.*;

@Component
public class TaskWorker {
    private static final Logger log=LoggerFactory.getLogger(TaskWorker.class);
    private final TaskMapper tasks;
    private final StoreMapper store;
    private final TaskStageService stages;
    private final FileStore files;
    private final CollageRenderer renderer;
    private final StageDelay delay;
    public TaskWorker(TaskMapper tasks,StoreMapper store,TaskStageService stages,FileStore files,CollageRenderer renderer,StageDelay delay) {
        this.tasks=tasks;this.store=store;this.stages=stages;this.files=files;this.renderer=renderer;this.delay=delay;
    }
    public void run(String id) {
        if(!stages.claim(id)) return;
        Stage current=null;
        try {
            TaskRow task=tasks.get(id);
            var assets=store.taskAssets(id);
            BufferedImage image=null;
            for(Stage stage:Stage.values()) {
                current=stage;
                if(!stages.begin(id,stage)) return;
                log.info("task={} stage={} boundary=start",id,stage);
                delay.pause(switch(stage) { case MATERIAL_CHECK -> task.checkMs(); case GENERATING -> task.generationMs(); case ORGANIZING -> task.organizeMs(); });
                if(task.failAt()==stage) {
                    stages.fail(id,"SIMULATED_FAILURE","演示：在"+stage+"阶段主动触发失败");
                    return;
                }
                String result=null;
                switch(stage) {
                    case MATERIAL_CHECK -> { for(Asset asset:assets) files.verify(asset); }
                    case GENERATING -> image=renderer.render(store.template(task.templateId()),assets);
                    case ORGANIZING -> result=files.publish(id,image);
                }
                if(!stages.complete(id,stage,result)) return;
                log.info("task={} stage={} boundary=end",id,stage);
            }
        } catch(InterruptedException e) {
            stages.fail(id,"SERVER_SHUTDOWN","服务停止，任务已中断");
            Thread.currentThread().interrupt();
        } catch(Exception e) {
            log.error("task={} stage={} failed",id,current,e);
            stages.fail(id,"STAGE_EXECUTION_ERROR",e instanceof ApiException?e.getMessage():"阶段处理异常，请检查素材或服务端存储后重新创建任务");
        }
    }
}
