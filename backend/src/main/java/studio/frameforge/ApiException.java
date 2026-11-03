package studio.frameforge;
public class ApiException extends RuntimeException {
    final int status;
    final String code;
    public ApiException(int status, String code, String message) { super(message); this.status=status; this.code=code; }
    public static ApiException missing() { return new ApiException(404,"NOT_FOUND","内容不存在或不属于当前用户"); }
    public static ApiException invalid(String message) { return new ApiException(400,"INVALID_INPUT",message); }
}
