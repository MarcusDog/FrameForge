package studio.frameforge;
import org.springframework.stereotype.Component;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.List;
import static studio.frameforge.Models.*;

@Component
public class CollageRenderer {
    private final FileStore files;
    public CollageRenderer(FileStore files) { this.files=files; }
    public BufferedImage render(Template template, List<Asset> assets) throws IOException {
        BufferedImage canvas=new BufferedImage(1200,900,BufferedImage.TYPE_INT_RGB);
        Graphics2D g=canvas.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setColor(new Color(246,242,234));g.fillRect(0,0,1200,900);
            g.setColor(new Color(43,49,66));g.setFont(new Font("SansSerif",Font.BOLD,25));
            g.drawString("FRAMEFORGE  /  "+template.layout().toUpperCase(),65,65);
            int count=assets.size(), gap=28, left=65, top=105, width=(1070-(count-1)*gap)/count;
            if("polaroid".equals(template.layout())) top=145;
            for(int i=0;i<count;i++) {
                int x=left+i*(width+gap), y=top+("polaroid".equals(template.layout())?i%2*40:0);
                g.setColor(Color.WHITE);g.fillRect(x-9,y-9,width+18,610);
                drawCover(g,files.read(assets.get(i).path()),x,y,width,550);
                g.setColor(new Color(87,86,100));g.setFont(new Font("SansSerif",Font.PLAIN,16));
                g.drawString("MEMORY 0"+(i+1),x+12,y+583);
            }
            g.setColor(new Color(92,80,179));g.setFont(new Font("SansSerif",Font.ITALIC,48));
            g.drawString("Little moments, beautifully kept.",65,820);
            g.setFont(new Font("SansSerif",Font.PLAIN,14));g.drawString("MADE WITH YOUR PHOTOS  /  FRAMEFORGE STUDIO",65,855);
        } finally { g.dispose(); }
        return canvas;
    }
    static void drawCover(Graphics2D g, BufferedImage image, int x,int y,int w,int h) {
        double scale=Math.max((double)w/image.getWidth(),(double)h/image.getHeight());
        int sw=(int)Math.round(w/scale),sh=(int)Math.round(h/scale);
        int sx=(image.getWidth()-sw)/2,sy=(image.getHeight()-sh)/2;
        g.drawImage(image,x,y,x+w,y+h,sx,sy,sx+sw,sy+sh,null);
    }
}
