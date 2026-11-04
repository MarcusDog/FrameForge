SET NAMES utf8mb4;
INSERT INTO demo_user(id,name) VALUES ('alice','Alice'),('bob','Bob') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO template(id,title,category,description,required_image_count,cover_url,layout) VALUES
('travel-postcard','旅行明信片','创意拼贴','把沿途风景装进明信片，让两段记忆在一张画面相遇。',2,'/demo/travel-postcard.png','postcard'),
('polaroid-story','拍立得故事','创意拼贴','三张照片，三个瞬间。用留白与错落排版收藏日常。',3,'/demo/polaroid-story.png','polaroid'),
('pet-portrait','宠物写真','生活影集','给毛茸茸的伙伴做一张专属封面，定格可爱的瞬间。',1,'/demo/pet-portrait.png','portrait'),
('city-journal','城市手记','生活影集','双图杂志封面，记录城市片刻。',2,'/demo/city-journal.png','magazine'),
('birthday-card','生日贺卡','节日海报','把一张照片变成一份温柔的祝福，记录值得庆祝的日子。',1,'/demo/birthday-card.png','celebration'),
('weekend-poster','周末来信','节日海报','满版照片与大字海报。',1,'/demo/weekend-poster.png','editorial'),
('film-diary','胶片日记','生活影集','三格胶片，串起一天的故事。',3,'/demo/film-diary.png','filmstrip'),
('minimal-gallery','留白画廊','创意拼贴','错落双图，留一点呼吸感。',2,'/demo/minimal-gallery.png','minimal'),
('sunset-letter','落日来信','节日海报','一张照片，一封温暖的信。',1,'/demo/sunset-letter.png','letter'),
('nature-collage','自然拼图','生活影集','一大两小的三图自然画册。',3,'/demo/nature-collage.png','mosaic'),
('memory-triptych','记忆三联','创意拼贴','深色三联画，收藏三个瞬间。',3,'/demo/memory-triptych.png','triptych'),
('together-duo','同行时光','节日海报','拱形双图，珍藏相伴时光。',2,'/demo/together-duo.png','duo')
ON DUPLICATE KEY UPDATE title=VALUES(title),category=VALUES(category),description=VALUES(description),required_image_count=VALUES(required_image_count),cover_url=VALUES(cover_url),layout=VALUES(layout);
