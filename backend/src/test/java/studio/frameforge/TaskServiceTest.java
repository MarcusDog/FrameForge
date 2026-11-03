package studio.frameforge;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.context.ApplicationEventPublisher;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static studio.frameforge.Models.*;

class TaskServiceTest {
    TaskMapper tasks=mock(TaskMapper.class);StoreMapper store=mock(StoreMapper.class);
    FileStore files=mock(FileStore.class);ApplicationEventPublisher events=mock(ApplicationEventPublisher.class);
    TaskService service=new TaskService(tasks,store,files,events,new ObjectMapper(),true);
    @BeforeEach void setup() {
        when(store.template("t")).thenReturn(new Template("t","t","c","d",1,"/demo","portrait"));
        when(store.asset("a","alice")).thenReturn(new Asset("a","alice","uploads/a.png","image/png",100,10,10,Instant.now()));
        when(files.exists("uploads/a.png")).thenReturn(true);
    }
    TaskRequest request(List<String> ids) { return new TaskRequest("t",ids,"k",null); }
    @Test void rejectsWrongCountAndForeignAssetsBeforeInsert() {
        assertThrows(ApiException.class,()->service.create("alice",request(List.of())));
        assertThrows(ApiException.class,()->service.create("bob",request(List.of("a"))));
        assertThrows(ApiException.class,()->service.create("alice",request(List.of("a","a"))));
        verify(tasks,never()).insert(any());verifyNoInteractions(events);
    }
    @Test void missingFileCannotCreateTask() {
        when(files.exists(any())).thenReturn(false);
        assertThrows(ApiException.class,()->service.create("alice",request(List.of("a"))));
        verify(tasks,never()).insert(any());
    }
    @Test void missingOrOtherUsersTaskReturnsNotFound() {
        ApiException error=assertThrows(ApiException.class,()->service.detail("bob","private"));
        assertEquals(404,error.status);
        verify(tasks).owned("private","bob");
    }
    @Test void disabledSimulationRejectsOverrides() {
        var disabled=new TaskService(tasks,store,files,events,new ObjectMapper(),false);
        assertThrows(ApiException.class,()->disabled.create("alice",new TaskRequest("t",List.of("a"),"k",new Simulation(null,0,0,0))));
        verify(tasks,never()).insert(any());
    }
}
