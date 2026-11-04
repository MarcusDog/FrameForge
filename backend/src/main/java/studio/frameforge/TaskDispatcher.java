package studio.frameforge;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.boot.ApplicationRunner;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import static studio.frameforge.Models.*;

@Configuration
public class TaskDispatcher {
    @Bean
    ThreadPoolTaskExecutor taskExecutor(@Value("${frameforge.queue-capacity}") int capacity,@Value("${frameforge.workers}") int workers) {
        if(workers<1||workers>4) throw new IllegalArgumentException("TASK_WORKERS must be between 1 and 4");
        ThreadPoolTaskExecutor executor=new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(workers);executor.setMaxPoolSize(workers);executor.setQueueCapacity(capacity);
        executor.setThreadNamePrefix("frameforge-worker-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }
    @Bean
    ApplicationRunner settleInterruptedTasks(TaskMapper tasks,TaskStageService stages) {
        return args -> tasks.unfinished().forEach(id -> stages.fail(id,"SERVER_RESTARTED","服务曾重启，任务已结束；请重新创建"));
    }
    @Bean
    DispatchListener dispatchListener(ThreadPoolTaskExecutor taskExecutor,TaskWorker worker,TaskStageService stages) {
        return new DispatchListener(taskExecutor,worker,stages);
    }
    public static class DispatchListener {
        private final ThreadPoolTaskExecutor executor;
        private final TaskWorker worker;
        private final TaskStageService stages;
        public DispatchListener(ThreadPoolTaskExecutor executor,TaskWorker worker,TaskStageService stages) {
            this.executor=executor;this.worker=worker;this.stages=stages;
        }
        @TransactionalEventListener
        public void created(TaskCreated event) {
            try { executor.execute(() -> worker.run(event.id())); }
            catch(RejectedExecutionException e) { stages.fail(event.id(),"EXECUTOR_SATURATED","当前任务队列已满，请稍后重新创建"); }
        }
    }
}
