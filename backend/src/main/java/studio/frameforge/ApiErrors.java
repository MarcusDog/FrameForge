package studio.frameforge;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import org.slf4j.*;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.ErrorResponse;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import java.io.IOException;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log=LoggerFactory.getLogger(ApiErrors.class);
    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> known(ApiException e) { return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage())); }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<?> size(Exception e) { return ResponseEntity.status(413).body(Map.of("code","FILE_TOO_LARGE","message","单张图片不能超过 5 MiB")); }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class,MissingServletRequestParameterException.class,MissingServletRequestPartException.class})
    ResponseEntity<?> invalid(Exception e,HttpServletRequest request) { return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message",request.getRequestURI().startsWith("/api/auth/")?"请检查用户名格式、密码长度和昵称":"请求参数不正确，请检查素材数量、格式和演示耗时")); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unexpected(Exception e) {
        if(e instanceof ErrorResponse response && response.getStatusCode().is4xxClientError()) {
            int status=response.getStatusCode().value();
            String message=switch(status) {
                case 404 -> "接口或资源不存在";
                case 405 -> "请求方法不支持，请检查接口说明";
                case 415 -> "请求类型不支持，请使用 JSON 或图片表单";
                default -> "请求不符合接口要求";
            };
            return ResponseEntity.status(status).headers(response.getHeaders()).body(Map.of("code","HTTP_"+status,"message",message));
        }
        log.error("Unhandled API error",e);
        return ResponseEntity.internalServerError().body(Map.of("code","INTERNAL_ERROR","message","服务暂时不可用，请稍后重试"));
    }
    @Component
    public static class Headers extends OncePerRequestFilter {
        @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws IOException,ServletException {
            if(req.getRequestURI().startsWith("/api/")) res.setHeader("Cache-Control","no-store");
            res.setHeader("X-Content-Type-Options","nosniff");
            chain.doFilter(req,res);
        }
    }
}
