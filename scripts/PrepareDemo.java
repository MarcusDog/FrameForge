import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.Map;

public class PrepareDemo {
    static Path directory;
    public static void main(String[] args) throws Exception {
        directory=Path.of(args.length>0?args[0]:"frontend/public/demo");
        var templates=Map.of(
            "travel-postcard",new String[]{"lake","mountains","POSTCARDS FROM SOMEWHERE","#e9e7dc"},
            "polaroid-story",new String[]{"mountains","lake","THE LITTLE THINGS","#e9e1e8"},
            "pet-portrait",new String[]{"dog","dog","HELLO, LITTLE FRIEND","#dbe8de"},
            "city-journal",new String[]{"city","city","A CITY TO REMEMBER","#eadfd5"},
            "birthday-card",new String[]{"birthday","birthday","MAKE A WISH","#f2e2cf"},
            "weekend-poster",new String[]{"weekend","lake","SLOW DAYS, GOOD DAYS","#dfe5ec"}
        );
        for(var entry:templates.entrySet()){
            var data=entry.getValue();
            var canvas=new BufferedImage(1200,900,BufferedImage.TYPE_INT_RGB);
            var g=canvas.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setColor(Color.decode(data[3]));g.fillRect(0,0,1200,900);
            g.setColor(new Color(255,255,255,75));g.fillOval(-130,-180,900,900);
            g.setColor(new Color(65,62,77,100));g.setFont(new Font("SansSerif",Font.PLAIN,18));g.drawString("F R A M E F O R G E   /   S T U D I O",60,65);
            if(entry.getKey().equals("polaroid-story")){
                paper(g,data[0],90,175,390,440,-.12,"01 / A MOMENT");
                paper(g,data[1],635,150,390,440,.10,"02 / A MEMORY");
                paper(g,"weekend",365,290,390,440,.025,"03 / A STORY");
            }else if(entry.getKey().equals("travel-postcard")||entry.getKey().equals("city-journal")){
                paper(g,data[0],120,130,650,510,-.10,"Somewhere beautiful.");
                paper(g,data[1],700,365,320,330,.15,"Wish you were here.");
            }else{
                paper(g,data[0],265,115,660,555,entry.getKey().equals("birthday-card")?-.04:.06,"Little moments, beautifully kept.");
                g.setFont(new Font("Serif",Font.PLAIN,65));g.setColor(new Color(255,255,255,170));g.drawString("✦",120,430);g.drawString("✦",1020,265);
            }
            g.setColor(new Color(75,67,83));g.setFont(new Font("Serif",Font.ITALIC,40));g.drawString(data[2],60,840);
            g.setFont(new Font("SansSerif",Font.PLAIN,14));g.drawString("MADE FOR YOUR MEMORIES",880,840);
            g.dispose();ImageIO.write(canvas,"png",directory.resolve(entry.getKey()+".png").toFile());
        }
    }
    static void paper(Graphics2D parent,String photo,int x,int y,int w,int h,double angle,String caption)throws Exception{
        Graphics2D g=(Graphics2D)parent.create();g.rotate(angle,x+w/2.0,y+h/2.0);
        g.setColor(new Color(65,55,75,20));g.fillRect(x+10,y+14,w,h+70);
        g.setColor(new Color(255,253,249));g.fillRect(x,y,w,h+70);
        BufferedImage image=ImageIO.read(directory.resolve("samples/"+photo+".jpg").toFile());
        double scale=Math.max((double)(w-26)/image.getWidth(),(double)(h-20)/image.getHeight());
        int sw=(int)((w-26)/scale),sh=(int)((h-20)/scale),sx=(image.getWidth()-sw)/2,sy=(image.getHeight()-sh)/2;
        g.drawImage(image,x+13,y+13,x+w-13,y+h-7,sx,sy,sx+sw,sy+sh,null);
        g.setColor(new Color(88,78,91));g.setFont(new Font("Serif",Font.ITALIC,Math.max(18,w/22)));g.drawString(caption,x+25,y+h+39);g.dispose();
    }
}
