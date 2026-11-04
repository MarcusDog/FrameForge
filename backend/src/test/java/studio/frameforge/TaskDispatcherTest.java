package studio.frameforge;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.RejectedExecutionException;
import static org.mockito.Mockito.*;
import static studio.frameforge.Models.*;

class TaskDispatcherTest {
    @Test void twoWorkersCanProcessIndependentJobsAtTheSameTime() throws Exception {
        var executor=new TaskDispatcher().taskExecutor(20,2);executor.initialize();
        var started=new java.util.concurrent.CountDownLatch(2);var release=new java.util.concurrent.CountDownLatch(1);
        try{
            for(int i=0;i<2;i++)executor.execute(()->{started.countDown();try{release.await();}catch(InterruptedException e){Thread.currentThread().interrupt();}});
            org.junit.jupiter.api.Assertions.assertTrue(started.await(5,java.util.concurrent.TimeUnit.SECONDS));
            org.junit.jupiter.api.Assertions.assertEquals(2,executor.getActiveCount());
        }finally{release.countDown();executor.shutdown();}
    }
    @Test void rejectedQueueIsPersistedInsteadOfRunningOnSubmitter() {
        var executor=mock(ThreadPoolTaskExecutor.class);var worker=mock(TaskWorker.class);var stages=mock(TaskStageService.class);
        doThrow(new RejectedExecutionException("full")).when(executor).execute(any(Runnable.class));
        new TaskDispatcher.DispatchListener(executor,worker,stages).created(new TaskCreated("id"));
        verify(stages).fail(eq("id"),eq("EXECUTOR_SATURATED"),anyString());
        verifyNoInteractions(worker);
    }
}
