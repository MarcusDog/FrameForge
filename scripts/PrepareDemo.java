import studio.frameforge.*;
import static studio.frameforge.Models.*;
import javax.imageio.ImageIO;
import java.nio.file.Path;
import java.nio.file.Files;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

// Uses the production renderer so each cover previews its actual output layout.
public class PrepareDemo {
    public static void main(String[] args) throws Exception {
        Path directory=Path.of(args.length>0?args[0]:"frontend/public/demo");
        FileStore files=new FileStore(directory.toString());
        CollageRenderer renderer=new CollageRenderer(files);
        var samples=Map.ofEntries(
            Map.entry("travel-postcard",List.of("lake","mountains")),
            Map.entry("polaroid-story",List.of("mountains","lake","weekend")),
            Map.entry("pet-portrait",List.of("dog")),Map.entry("city-journal",List.of("city","weekend")),
            Map.entry("birthday-card",List.of("birthday")),Map.entry("weekend-poster",List.of("weekend")),
            Map.entry("film-diary",List.of("city","lake","dog")),Map.entry("minimal-gallery",List.of("mountains","lake")),
            Map.entry("sunset-letter",List.of("weekend")),Map.entry("nature-collage",List.of("mountains","lake","weekend")),
            Map.entry("memory-triptych",List.of("city","mountains","lake")),Map.entry("together-duo",List.of("dog","birthday"))
        );
        var pattern=Pattern.compile("^\\('([^']+)','([^']+)','([^']+)','([^']+)',([0-9]+),'([^']+)','([^']+)'\\)[,;]?$");
        int generated=0;
        for(String line:Files.readAllLines(Path.of("database/002-seed.sql"))){
            var m=pattern.matcher(line);if(!m.matches())continue;
            var template=new Template(m.group(1),m.group(2),m.group(3),m.group(4),Integer.parseInt(m.group(5)),m.group(6),m.group(7));
            var assets=new ArrayList<Asset>();
            for(String name:samples.get(template.id())){
                String relative="samples/"+name+".jpg";Path image=directory.resolve(relative);
                var decoded=ImageIO.read(image.toFile());
                assets.add(new Asset(name,"demo",relative,"image/jpeg",Files.size(image),decoded.getWidth(),decoded.getHeight(),Instant.EPOCH));
            }
            ImageIO.write(renderer.render(template,assets),"png",directory.resolve(template.id()+".png").toFile());generated++;
        }
        if(generated!=12)throw new IllegalStateException("Expected 12 covers, got "+generated);
        System.out.println("Generated "+generated+" covers using the production renderer");
    }
}
