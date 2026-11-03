SET NAMES utf8mb4;
INSERT INTO demo_user(id,name) VALUES ('alice','Alice'),('bob','Bob') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO template(id,title,category,description,required_image_count,cover_url,layout) VALUES
('travel-postcard','旅行明信片','创意拼贴','把沿途风景装进明信片，让两段记忆在一张画面相遇。',2,'/demo/travel-postcard.png','postcard'),
('polaroid-story','拍立得故事','创意拼贴','三张照片，三个瞬间。用留白与错落排版收藏日常。',3,'/demo/polaroid-story.png','polaroid'),
('pet-portrait','宠物写真','生活影集','给毛茸茸的伙伴做一张专属封面，定格可爱的瞬间。',1,'/demo/pet-portrait.png','portrait'),
('city-journal','城市手记','生活影集','用两张街景，拼成一页属于你的城市观察日记。',2,'/demo/city-journal.png','postcard'),
('birthday-card','生日贺卡','节日海报','把一张照片变成一份温柔的祝福，记录值得庆祝的日子。',1,'/demo/birthday-card.png','celebration'),
('weekend-poster','周末来信','节日海报','一张照片，一份好心情。给平凡周末一点仪式感。',1,'/demo/weekend-poster.png','celebration')
ON DUPLICATE KEY UPDATE title=VALUES(title),category=VALUES(category),description=VALUES(description),required_image_count=VALUES(required_image_count),cover_url=VALUES(cover_url),layout=VALUES(layout);
