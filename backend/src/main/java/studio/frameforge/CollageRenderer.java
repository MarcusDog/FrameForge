package studio.frameforge;

import org.springframework.stereotype.Component;
import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import static studio.frameforge.Models.*;

@Component
public class CollageRenderer {
    private final FileStore files;
    public CollageRenderer(FileStore files) { this.files=files; }
    public BufferedImage render(Template template,List<Asset> assets) throws IOException {
        if(assets.size()!=template.requiredImageCount()) throw ApiException.invalid("素材数量不符合模板要求");
        var photos=new ArrayList<BufferedImage>();
        for(Asset asset:assets) photos.add(files.read(asset.path()));
        var canvas=new BufferedImage(1200,900,BufferedImage.TYPE_INT_RGB);
        Graphics2D g=canvas.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            background(g,"#f6f2ea");
            switch(template.layout()) {
                case "postcard" -> {
                    text(g,"POSTCARDS FROM SOMEWHERE",65,67,27,"#393e4d");
                    int width=(1070-(photos.size()-1)*28)/photos.size();
                    for(int i=0;i<photos.size();i++) paper(g,photos.get(i),65+i*(width+28),105,width,550,0,"MEMORY 0"+(i+1));
                    text(g,"Wish you were here.",65,820,44,"#6551a2");
                }
                case "polaroid" -> {
                    background(g,"#e9e0e7");text(g,"THE LITTLE THINGS",65,75,30,"#5a4055");
                    for(int i=0;i<photos.size();i++) paper(g,photos.get(i),75+i*355,150+(i%2)*65,315,450,(i-1)*.09,"A MOMENT / 0"+(i+1));
                    text(g,"Collected, not forgotten.",65,835,38,"#6a5260");
                }
                case "portrait" -> {
                    background(g,"#dce9df");g.setColor(Color.WHITE);g.fillOval(240,100,720,720);
                    photo(g,photos.getFirst(),290,150,620,620,new Ellipse2D.Double(290,150,620,620));
                    text(g,"HELLO, LITTLE FRIEND",280,75,36,"#2c5746");text(g,"A portrait of happiness.",350,835,29,"#416954");
                }
                case "magazine" -> {
                    background(g,"#f0ede4");text(g,"CITY NOTES",55,125,102,"#202832");
                    photo(g,photos.getFirst(),55,185,640,640,null);photo(g,photos.get(1),735,185,410,410,null);
                    text(g,"02 / URBAN JOURNAL",735,660,24,"#4c555b");text(g,"WALK. LOOK.",735,735,42,"#202832");text(g,"REMEMBER.",735,790,42,"#202832");
                }
                case "celebration" -> {
                    background(g,"#f5d5c8");
                    for(int i=0;i<44;i++){g.setColor(i%2==0?new Color(226,132,106):new Color(255,246,223));int x=(i*173)%1200,y=(i*257)%900;g.fillOval(x,y,15+i%3*8,15+i%3*8);}
                    paper(g,photos.getFirst(),220,100,760,605,-.025,"A DAY TO CELEBRATE");text(g,"MAKE A WISH",340,835,57,"#954635");
                }
                case "editorial" -> {
                    photo(g,photos.getFirst(),0,0,1200,900,null);g.setColor(new Color(17,28,40,175));g.fillRect(0,625,1200,275);
                    text(g,"SLOW WEEKEND",65,735,79,"#ffffff");text(g,"A LITTLE TIME FOR YOURSELF",70,810,27,"#f1e5cf");
                }
                case "filmstrip" -> {
                    background(g,"#242326");text(g,"ON FILM / 03",55,78,32,"#f0c985");
                    for(int x=18;x<1200;x+=55){g.setColor(new Color(236,229,207));g.fillRoundRect(x,110,24,18,4,4);g.fillRoundRect(x,770,24,18,4,4);}
                    for(int i=0;i<3;i++){photo(g,photos.get(i),55+i*370,155,350,575,null);text(g,"FRAME 0"+(i+1),55+i*370,840,23,"#eee4d4");}
                }
                case "minimal" -> {
                    background(g,"#ffffff");text(g,"STILL / LIFE",80,90,30,"#34353b");
                    photo(g,photos.getFirst(),80,205,450,500,null);photo(g,photos.get(1),650,125,450,500,null);
                    g.setColor(new Color(185,178,165));g.drawLine(650,680,1100,680);text(g,"ROOM TO BREATHE",650,730,24,"#6f695f");text(g,"01 / TWO MOMENTS",80,820,23,"#6f695f");
                }
                case "letter" -> {
                    background(g,"#eee2c8");photo(g,photos.getFirst(),55,90,740,720,null);
                    text(g,"DEAR YOU,",845,315,37,"#6b5440");text(g,"A little light.",845,395,25,"#8c7156");text(g,"A little quiet.",845,440,25,"#8c7156");
                    g.setColor(new Color(163,137,100));g.drawRect(995,90,120,140);text(g,"POST",1018,170,23,"#8c7156");
                    for(int y=555;y<750;y+=55)g.drawLine(845,y,1130,y);
                }
                case "mosaic" -> {
                    background(g,"#1e4942");photo(g,photos.getFirst(),45,100,690,750,null);photo(g,photos.get(1),765,100,390,350,null);photo(g,photos.get(2),765,500,390,350,null);
                    text(g,"OUTSIDE / A NATURAL COLLECTION",45,65,27,"#e3edcf");
                }
                case "triptych" -> {
                    background(g,"#222d48");text(g,"THREE PLACES, ONE STORY",60,95,37,"#ede6da");
                    for(int i=0;i<3;i++){photo(g,photos.get(i),60+i*365,160,350,610,null);text(g,"0"+(i+1),60+i*365,835,35,"#cabfa4");}
                }
                case "duo" -> {
                    background(g,"#f1dce1");
                    for(int i=0;i<2;i++)photo(g,photos.get(i),100+i*525,115,475,590,new RoundRectangle2D.Double(100+i*525,115,475,590,230,230));
                    text(g,"BETTER TOGETHER",255,815,58,"#864c62");
                }
                default -> throw ApiException.invalid("模板版式不可用");
            }
        } finally {g.dispose();}
        return canvas;
    }
    private static void background(Graphics2D g,String color){g.setColor(Color.decode(color));g.fillRect(0,0,1200,900);}
    private static void text(Graphics2D g,String text,int x,int y,int size,String color){g.setColor(Color.decode(color));g.setFont(new Font("SansSerif",Font.BOLD,size));g.drawString(text,x,y);}
    private static void photo(Graphics2D parent,BufferedImage image,int x,int y,int w,int h,Shape clip){
        Graphics2D g=(Graphics2D)parent.create();
        try{if(clip!=null)g.clip(clip);drawCover(g,image,x,y,w,h);}finally{g.dispose();}
    }
    private static void paper(Graphics2D parent,BufferedImage image,int x,int y,int w,int h,double rotation,String caption){
        Graphics2D g=(Graphics2D)parent.create();
        try{g.rotate(rotation,x+w/2.0,y+h/2.0);g.setColor(new Color(255,253,249));g.fillRect(x-9,y-9,w+18,h+65);drawCover(g,image,x,y,w,h);text(g,caption,x+12,y+h+38,19,"#645c62");}finally{g.dispose();}
    }
    static void drawCover(Graphics2D g,BufferedImage image,int x,int y,int w,int h){
        double scale=Math.max((double)w/image.getWidth(),(double)h/image.getHeight());
        int sw=Math.max(1,(int)Math.round(w/scale)),sh=Math.max(1,(int)Math.round(h/scale));
        int sx=(image.getWidth()-sw)/2,sy=(image.getHeight()-sh)/2;
        g.drawImage(image,x,y,x+w,y+h,sx,sy,sx+sw,sy+sh,null);
    }
}
