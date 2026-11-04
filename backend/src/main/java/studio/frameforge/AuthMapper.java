package studio.frameforge;

import java.time.Instant;
import org.apache.ibatis.annotations.*;
import static studio.frameforge.Models.*;

@Mapper
public interface AuthMapper {
    @Insert("INSERT INTO demo_user(id,name) VALUES(#{id},#{name})") void insertUser(DemoUser user);
    @Insert("INSERT INTO user_profile(user_id,nickname) VALUES(#{userId},#{nickname})")
    void insertProfile(@Param("userId") String userId,@Param("nickname") String nickname);
    @Insert("INSERT INTO account_credential(username,user_id,salt,password_hash,iterations) VALUES(#{username},#{userId},#{salt},#{passwordHash},#{iterations})")
    void insertCredential(Credential credential);
    @Select("SELECT * FROM account_credential WHERE username=#{username} FOR UPDATE") Credential credential(String username);
    @Update("UPDATE account_credential SET failed_attempts=#{attempts},locked_until=#{until} WHERE username=#{username}")
    void attempts(@Param("username") String username,@Param("attempts") int attempts,@Param("until") Instant until);
    @Insert("INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES(#{hash},#{userId},#{expires})")
    void session(@Param("hash") String hash,@Param("userId") String userId,@Param("expires") Instant expires);
    @Select("SELECT u.* FROM demo_user u JOIN auth_session s ON s.user_id=u.id WHERE s.token_hash=#{hash} AND s.expires_at>CURRENT_TIMESTAMP(3)")
    DemoUser sessionUser(String hash);
    @Delete("DELETE FROM auth_session WHERE token_hash=#{hash}") void revoke(String hash);
    @Delete("DELETE FROM auth_session WHERE expires_at<=CURRENT_TIMESTAMP(3)") void removeExpired();
}
