package studio.frameforge;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.*;
import static studio.frameforge.Models.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final StoreMapper store;
    private final AssetService assets;
    private final TaskService tasks;
    private final FileStore files;
    private final ProfileService profiles;
    private final boolean simulationEnabled;
    public ApiController(StoreMapper store,AssetService assets,TaskService tasks,FileStore files,ProfileService profiles,
                         @Value("${frameforge.simulation-enabled}") boolean enabled) {
        this.store=store;this.assets=assets;this.tasks=tasks;this.files=files;this.profiles=profiles;this.simulationEnabled=enabled;
    }
    private String user(HttpServletRequest request) {
        if(request.getCookies()!=null) for(var cookie:request.getCookies()) {
            if(cookie.getName().equals("ff_demo_user") && store.user(cookie.getValue())!=null) return cookie.getValue();
        }
        throw new ApiException(401,"IDENTITY_REQUIRED","请先选择 Alice 或 Bob 演示身份");
    }
    @GetMapping("/demo/users") public List<DemoUser> users() { return store.users(); }
    @GetMapping("/demo/session") public DemoUser session(HttpServletRequest request) { return store.user(user(request)); }
    @GetMapping("/me/summary") public UserSummary summary(HttpServletRequest request) { return store.summary(user(request)); }
    @GetMapping("/me/profile") public UserProfile profile(HttpServletRequest request) { return profiles.get(user(request)); }
    @PutMapping("/me/profile") public UserProfile profile(@Valid @RequestBody ProfileRequest body,HttpServletRequest request) throws IOException {
        return profiles.update(user(request),body);
    }
    @DeleteMapping("/demo/session") public Map<String,Boolean> logout(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("ff_demo_user","").httpOnly(true).sameSite("Lax").path("/").maxAge(0).build().toString());
        return Map.of("signedOut",true);
    }
    @PostMapping("/demo/session")
    public DemoUser session(@Valid @RequestBody SessionRequest body,HttpServletResponse response) {
        DemoUser user=store.user(body.userId());
        if(user==null) throw ApiException.invalid("请选择有效演示用户");
        response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("ff_demo_user",user.id()).httpOnly(true).sameSite("Lax").path("/").maxAge(604800).build().toString());
        return user;
    }
    @GetMapping("/config") public Map<String,Boolean> config() { return Map.of("simulationEnabled",simulationEnabled); }
    @GetMapping("/templates") public List<Template> templates() { return store.templates(); }
    @GetMapping("/templates/{id}") public Template template(@PathVariable String id) { return tasks.template(id); }
    @PostMapping("/assets")
    public AssetView upload(@RequestParam MultipartFile file,HttpServletRequest request) throws IOException { return assets.upload(user(request),file); }
    @GetMapping("/assets/{id}/content")
    public ResponseEntity<FileSystemResource> asset(@PathVariable String id,HttpServletRequest request) {
        Asset asset=assets.owned(id,user(request));
        return image(asset.path(),asset.mimeType());
    }
    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Accepted submit(@Valid @RequestBody TaskRequest body,HttpServletRequest request) throws IOException {
        String owner=user(request);
        String id=tasks.create(owner,body);
        return new Accepted(id,tasks.detail(owner,id));
    }
    @GetMapping("/tasks")
    public TaskPage history(@RequestParam(defaultValue="false") boolean active,@RequestParam(required=false) Long before,
                            @RequestParam(defaultValue="20") int limit,HttpServletRequest request) {
        return tasks.history(user(request),active,before,limit);
    }
    @GetMapping("/tasks/{id}")
    public TaskView task(@PathVariable String id,HttpServletRequest request) { return tasks.detail(user(request),id); }
    @GetMapping("/tasks/{id}/result")
    public ResponseEntity<FileSystemResource> result(@PathVariable String id,HttpServletRequest request) {
        TaskRow task=tasks.owned(user(request),id);
        if(task.status()!=Status.SUCCEEDED || task.resultPath()==null) throw ApiException.missing();
        return image(task.resultPath(),"image/png");
    }
    private ResponseEntity<FileSystemResource> image(String path,String mime) {
        if(!files.exists(path)) throw ApiException.missing();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(mime))
            .header(HttpHeaders.CONTENT_DISPOSITION,"inline").body(new FileSystemResource(files.path(path)));
    }
}
