package studio.frameforge;
import org.apache.ibatis.annotations.*;
import java.util.List;
import static studio.frameforge.Models.*;

@Mapper
public interface TaskMapper {
    @Insert("""
        INSERT INTO task(id,user_id,template_id,status,request_key,payload_hash,check_ms,generation_ms,organize_ms,fail_at)
        VALUES(#{id},#{userId},#{templateId},'QUEUED',#{requestKey},#{payloadHash},#{checkMs},#{generationMs},#{organizeMs},#{failAt})
        ON DUPLICATE KEY UPDATE id=id
        """)
    void insert(TaskRow row);
    @Select("SELECT * FROM task WHERE user_id=#{userId} AND request_key=#{key} FOR UPDATE")
    TaskRow byKey(@Param("userId") String userId, @Param("key") String key);
    @Select("SELECT * FROM task WHERE id=#{id} AND user_id=#{userId}")
    TaskRow owned(@Param("id") String id, @Param("userId") String userId);
    @Select("SELECT * FROM task WHERE id=#{id}") TaskRow get(String id);
    @Select("SELECT * FROM task WHERE id=#{id} FOR UPDATE") TaskRow lock(String id);
    @Select("SELECT * FROM task WHERE user_id=#{userId} AND seq < #{before} AND (#{active}=false OR status IN ('QUEUED','RUNNING')) ORDER BY seq DESC LIMIT #{limit}")
    List<TaskRow> list(@Param("userId") String userId, @Param("active") boolean active, @Param("before") long before, @Param("limit") int limit);
    @Select("SELECT id FROM task WHERE status IN ('QUEUED','RUNNING')") List<String> unfinished();
    @Insert("INSERT INTO task_asset(task_id,asset_id,position) VALUES(#{taskId},#{assetId},#{position})")
    void attach(@Param("taskId") String taskId, @Param("assetId") String assetId, @Param("position") int position);
    @Insert("INSERT INTO task_stage(task_id,stage) VALUES(#{id},#{stage})")
    void addStage(@Param("id") String id, @Param("stage") Stage stage);
    @Select("SELECT * FROM task_stage WHERE task_id=#{id} ORDER BY FIELD(stage,'MATERIAL_CHECK','GENERATING','ORGANIZING')")
    List<StageRow> stages(String id);
    @Update("UPDATE task SET status='RUNNING',version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=#{id} AND status='QUEUED'")
    int claim(String id);
    @Update("UPDATE task_stage SET status='RUNNING',started_at=CURRENT_TIMESTAMP(3) WHERE task_id=#{id} AND stage=#{stage} AND status='PENDING'")
    int startStage(@Param("id") String id, @Param("stage") Stage stage);
    @Update("UPDATE task SET current_stage=#{stage},version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=#{id} AND status='RUNNING'")
    void current(@Param("id") String id, @Param("stage") Stage stage);
    @Update("""
        UPDATE task_stage SET status=#{status},ended_at=CURRENT_TIMESTAMP(3),
        duration_ms=TIMESTAMPDIFF(MICROSECOND,started_at,CURRENT_TIMESTAMP(3)) DIV 1000,error_message=#{message}
        WHERE task_id=#{id} AND stage=#{stage} AND status='RUNNING'
        """)
    int endStage(@Param("id") String id,@Param("stage") Stage stage,@Param("status") String status,@Param("message") String message);
    @Update("""
        UPDATE task SET status=IF(#{resultPath} IS NULL,'RUNNING','SUCCEEDED'),result_path=#{resultPath},
        version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=#{id} AND status='RUNNING'
        """)
    void advance(@Param("id") String id,@Param("resultPath") String resultPath);
    @Update("""
        UPDATE task SET status='FAILED',error_code=#{code},error_message=#{message},
        version=version+1,updated_at=CURRENT_TIMESTAMP(3)
        WHERE id=#{id} AND status IN ('QUEUED','RUNNING')
        """)
    void fail(@Param("id") String id,@Param("code") String code,@Param("message") String message);
    @Update("UPDATE task_stage SET status='SKIPPED' WHERE task_id=#{id} AND status='PENDING'")
    void skipPending(String id);
}
