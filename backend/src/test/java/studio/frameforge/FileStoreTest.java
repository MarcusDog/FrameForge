package studio.frameforge;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static studio.frameforge.Models.*;

class FileStoreTest {
    @TempDir Path temporary;
    FileStore files;
    @BeforeEach void setup() throws Exception { files=new FileStore(temporary.toString()); }
    byte[] png(int width,int height,Color color) throws IOException {
        BufferedImage image=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);
        Graphics2D g=image.createGraphics();g.setColor(color);g.fillRect(0,0,width,height);g.dispose();
        ByteArrayOutputStream out=new ByteArrayOutputStream();ImageIO.write(image,"png",out);return out.toByteArray();
    }
    @Test void checksBytesMimeDimensionsAndDecode() throws Exception {
        assertEquals(40,files.inspect(png(40,30,Color.RED),"image/png").width());
        assertThrows(ApiException.class,()->files.inspect(png(10,10,Color.RED),"image/jpeg"));
        assertThrows(ApiException.class,()->files.inspect("not an image".getBytes(),"image/png"));
        assertThrows(ApiException.class,()->files.inspect(new byte[0],"image/png"));
        assertThrows(ApiException.class,()->files.inspect(new byte[5*1024*1024+1],"image/png"));
        assertThrows(ApiException.class,()->files.inspect(png(8193,1,Color.RED),"image/png"));
        assertThrows(ApiException.class,()->files.path("../escape"));
    }
    @Test void pngResultContainsBothUploadedImagesAndIsAccessible() throws Exception {
        files.write("uploads/a.png",png(100,100,Color.RED));
        files.write("uploads/b.png",png(100,100,Color.BLUE));
        var a=new Asset("a","alice","uploads/a.png","image/png",100,100,100,Instant.now());
        var b=new Asset("b","alice","uploads/b.png","image/png",100,100,100,Instant.now());
        var template=new Template("t","t","c","d",2,"/cover","postcard");
        BufferedImage collage=new CollageRenderer(files).render(template,List.of(a,b));
        String result=files.publish("test",collage);
        assertTrue(files.exists(result));
        BufferedImage decoded=files.read(result);
        assertEquals(1200,decoded.getWidth());assertEquals(900,decoded.getHeight());
        assertEquals(Color.RED.getRGB(),decoded.getRGB(100,200));
        assertEquals(Color.BLUE.getRGB(),decoded.getRGB(750,200));
    }
}
