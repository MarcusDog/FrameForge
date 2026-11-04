package studio.frameforge;

import java.io.IOException;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static studio.frameforge.Models.*;

@Service
public class ProfileService {
    private final StoreMapper store;
    private final FileStore files;
    public ProfileService(StoreMapper store,FileStore files) { this.store=store;this.files=files; }
    public UserProfile get(String userId) {
        UserProfile profile=store.profile(userId);
        if(profile==null) throw ApiException.missing();
        return profile;
    }
    @Transactional
    public UserProfile update(String userId,ProfileRequest request) throws IOException {
        get(userId);
        String nickname=request.nickname().strip();
        if(nickname.isBlank()||nickname.codePoints().anyMatch(Character::isISOControl))
            throw ApiException.invalid("昵称不能为空或包含控制字符");
        if(request.avatarAssetId()!=null) {
            Asset avatar=store.asset(request.avatarAssetId(),userId);
            if(avatar==null) throw ApiException.missing();
            files.verify(avatar);
        }
        var normalized=new ProfileRequest(nickname,request.bio().strip(),request.avatarColor().toLowerCase(Locale.ROOT),
            request.avatarAssetId(),request.version());
        if(store.updateProfile(userId,normalized)!=1)
            throw new ApiException(409,"PROFILE_CHANGED","资料已在其他页面更新，请重新加载后再保存");
        return get(userId);
    }
}
