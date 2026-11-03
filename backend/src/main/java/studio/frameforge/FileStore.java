package studio.frameforge;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.Iterator;

@Component
public class FileStore {
    private final Path root;
    public FileStore(@Value("${frameforge.storage}") String directory) throws IOException {
        root=Path.of(directory).toAbsolutePath().normalize();
        Files.createDirectories(root.resolve("uploads"));
        Files.createDirectories(root.resolve("results"));
    }
    public record ImageInfo(String mimeType, int width, int height) {}
    public ImageInfo inspect(byte[] bytes, String claimedMime) throws IOException {
        if(bytes.length==0 || bytes.length>5*1024*1024) throw ApiException.invalid("图片不能为空且不能超过 5 MiB");
        try (ImageInputStream in=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers=ImageIO.getImageReaders(in);
            if(!readers.hasNext()) throw ApiException.invalid("文件不是可识别的 JPEG/PNG 图片");
            ImageReader reader=readers.next();
            try {
                reader.setInput(in, true, true);
                String format=reader.getFormatName().toLowerCase();
                String mime=switch(format) { case "jpeg","jpg" -> "image/jpeg"; case "png" -> "image/png"; default -> ""; };
                if(mime.isEmpty() || !mime.equals(claimedMime)) throw ApiException.invalid("图片内容与声明的 JPEG/PNG 类型不一致");
                int w=reader.getWidth(0),h=reader.getHeight(0);
                if(w<1 || h<1 || w>8192 || h>8192 || (long)w*h>25_000_000) throw ApiException.invalid("图片尺寸超过限制（单边 8192、总像素 2500 万）");
                if(reader.read(0)==null) throw ApiException.invalid("图片内容无法解码");
                return new ImageInfo(mime,w,h);
            } catch (javax.imageio.IIOException e) { throw ApiException.invalid("图片已损坏，无法解码"); }
            finally { reader.dispose(); }
        }
    }
    public Path path(String relative) {
        Path resolved=root.resolve(relative).normalize();
        if(!resolved.startsWith(root)) throw ApiException.invalid("无效文件路径");
        return resolved;
    }
    public void write(String relative, byte[] bytes) throws IOException { Files.write(path(relative),bytes,StandardOpenOption.CREATE_NEW); }
    public boolean exists(String relative) { return Files.isRegularFile(path(relative)); }
    public BufferedImage read(String relative) throws IOException {
        BufferedImage image=ImageIO.read(path(relative).toFile());
        if(image==null) throw new IOException("Unreadable image");
        return image;
    }
    public void verify(Models.Asset asset) throws IOException {
        if(!exists(asset.path())) throw ApiException.invalid("素材文件已不存在，请重新上传");
        inspect(Files.readAllBytes(path(asset.path())),asset.mimeType());
    }
    public String publish(String taskId, BufferedImage image) throws IOException {
        String relative="results/"+taskId+".png";
        Path temporary=Files.createTempFile(root.resolve("results"),taskId,".tmp");
        try {
            if(!ImageIO.write(image,"png",temporary.toFile())) throw new IOException("PNG encoder unavailable");
            Files.move(temporary,path(relative),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temporary); }
        return relative;
    }
    public void remove(String relative) throws IOException { Files.deleteIfExists(path(relative)); }
}
