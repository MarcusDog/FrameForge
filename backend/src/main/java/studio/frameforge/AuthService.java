package studio.frameforge;

import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static studio.frameforge.Models.*;

@Service
public class AuthService {
    private static final int ITERATIONS=600000;
    private final SecureRandom random=new SecureRandom();
    private final AuthMapper auth;
    private final StoreMapper store;
    private final boolean demoEnabled,secureCookie;
    public AuthService(AuthMapper auth,StoreMapper store,@Value("${frameforge.demo-enabled:true}") boolean demoEnabled,
                       @Value("${frameforge.secure-cookie:false}") boolean secureCookie) {
        this.auth=auth;this.store=store;this.demoEnabled=demoEnabled;this.secureCookie=secureCookie;
    }
    public boolean demoEnabled() { return demoEnabled; }
    static String cookie(HttpServletRequest request,String name) {
        if(request.getCookies()!=null) for(var cookie:request.getCookies()) if(cookie.getName().equals(name)) return cookie.getValue();
        return null;
    }
    private void cookie(HttpServletResponse response,String name,String value,long age) {
        response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from(name,value).httpOnly(true).secure(secureCookie)
            .sameSite("Lax").path("/").maxAge(age).build().toString());
    }
    public DemoUser current(HttpServletRequest request) {
        String token=cookie(request,"ff_session");
        if(token!=null) {
            DemoUser user=token.matches("[A-Za-z0-9_-]{43}")?auth.sessionUser(digest(token)):null;
            if(user!=null)return user;
        } else if(demoEnabled) {
            String id=cookie(request,"ff_demo_user");
            if("alice".equals(id)||"bob".equals(id)) { DemoUser user=store.user(id);if(user!=null)return user; }
        }
        throw new ApiException(401,"IDENTITY_REQUIRED","请登录或选择演示账户");
    }
    private void revoke(HttpServletRequest request) {
        String token=cookie(request,"ff_session");if(token!=null)auth.revoke(digest(token));
    }
    public void logout(HttpServletRequest request,HttpServletResponse response) {
        revoke(request);
        cookie(response,"ff_session","",0);cookie(response,"ff_demo_user","",0);
    }
    public DemoUser demo(String id,HttpServletRequest request,HttpServletResponse response) {
        if(!demoEnabled)throw ApiException.missing();
        if(!"alice".equals(id)&&!"bob".equals(id))throw ApiException.invalid("请选择有效演示用户");
        revoke(request);cookie(response,"ff_demo_user",id,604800);cookie(response,"ff_session","",0);return store.user(id);
    }
    private void establish(String userId,HttpServletRequest request,HttpServletResponse response) {
        revoke(request);auth.removeExpired();
        byte[] bytes=new byte[32];random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        auth.session(digest(token),userId,Instant.now().plusSeconds(604800));cookie(response,"ff_session",token,604800);cookie(response,"ff_demo_user","",0);
    }
    @Transactional
    public DemoUser register(RegisterRequest request,HttpServletRequest http,HttpServletResponse response) {
        String username=request.username().toLowerCase(Locale.ROOT),nickname=request.nickname().strip();
        if(nickname.isBlank()||nickname.codePoints().anyMatch(Character::isISOControl))throw ApiException.invalid("请输入有效昵称");
        if(Set.of("alice","bob").contains(username))throw new ApiException(409,"USERNAME_TAKEN","用户名已被使用");
        byte[] salt=new byte[16];random.nextBytes(salt);
        String id="u_"+UUID.randomUUID().toString().replace("-","").substring(0,16);
        var user=new DemoUser(id,username);
        try {
            auth.insertUser(user);auth.insertProfile(id,nickname);
            auth.insertCredential(new Credential(username,id,Base64.getEncoder().encodeToString(salt),
                Base64.getEncoder().encodeToString(derive(request.password(),salt,ITERATIONS)),ITERATIONS,0,null));
        } catch(DuplicateKeyException e) { throw new ApiException(409,"USERNAME_TAKEN","用户名已被使用"); }
        establish(id,http,response);return user;
    }
    @Transactional(noRollbackFor=ApiException.class)
    public DemoUser login(LoginRequest request,HttpServletRequest http,HttpServletResponse response) {
        String username=request.username().toLowerCase(Locale.ROOT);
        Credential credential=auth.credential(username);
        if(credential!=null&&credential.lockedUntil()!=null&&credential.lockedUntil().isAfter(Instant.now()))
            throw new ApiException(429,"LOGIN_LOCKED","尝试次数过多，请一分钟后重试");
        byte[] salt=credential==null?new byte[16]:Base64.getDecoder().decode(credential.salt());
        byte[] actual=derive(request.password(),salt,credential==null?ITERATIONS:credential.iterations());
        if(credential==null||!MessageDigest.isEqual(actual,Base64.getDecoder().decode(credential.passwordHash()))) {
            if(credential!=null) {
                int attempts=credential.lockedUntil()!=null?1:credential.failedAttempts()+1;
                auth.attempts(username,attempts,attempts>=5?Instant.now().plusSeconds(60):null);
            }
            throw new ApiException(401,"INVALID_CREDENTIALS","用户名或密码不正确");
        }
        auth.attempts(username,0,null);establish(credential.userId(),http,response);return store.user(credential.userId());
    }
    private static byte[] derive(String password,byte[] salt,int iterations) {
        var spec=new PBEKeySpec(password.toCharArray(),salt,iterations,256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        catch(GeneralSecurityException e) { throw new IllegalStateException("Password hashing unavailable",e); }
        finally { spec.clearPassword(); }
    }
    static String digest(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
