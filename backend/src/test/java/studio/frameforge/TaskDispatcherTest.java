package studio.frameforge;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.RejectedExecutionException;
import static org.mockito.Mockito.*;
import static studio.frameforge.Models.*;

class TaskDispatcherTest {
    @Test void rejectedQueueIsPersistedInsteadOfRunningOnSubmitter() {
        var executor=mock(ThreadPoolTaskExecutor.class);var worker=mock(TaskWorker.class);var stages=mock(TaskStageService.class);
        doThrow(new RejectedExecutionException("full")).when(executor).execute(any(Runnable.class));
        new TaskDispatcher.DispatchListener(executor,worker,stages).created(new TaskCreated("id"));
        verify(stages).fail(eq("id"),eq("EXECUTOR_SATURATED"),anyString());
        verifyNoInteractions(worker);
    }
}
