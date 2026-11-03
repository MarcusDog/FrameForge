package studio.frameforge;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import static studio.frameforge.Models.*;

@Service
public class AssetService {
    private final StoreMapper store;
    private final FileStore files;
    public AssetService(StoreMapper store, FileStore files) { this.store=store; this.files=files; }
    public AssetView upload(String user, MultipartFile file) throws IOException {
        byte[] bytes=file.getBytes();
        var info=files.inspect(bytes,file.getContentType());
        String id=UUID.randomUUID().toString();
        String path="uploads/"+id+("image/png".equals(info.mimeType())?".png":".jpg");
        Asset asset=new Asset(id,user,path,info.mimeType(),bytes.length,info.width(),info.height(),Instant.now());
        files.write(path,bytes);
        try { store.insertAsset(asset); }
        catch(RuntimeException e) { try { files.remove(path); } catch(IOException cleanup) { e.addSuppressed(cleanup); } throw e; }
        return asset.view();
    }
    public Asset owned(String id,String user) {
        Asset asset=store.asset(id,user);
        if(asset==null) throw ApiException.missing();
        return asset;
    }
}
