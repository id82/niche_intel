Review the author extraction logic in the scrapers.js and confirm that the same author extraction logic is being used as in the function below.
As in a recent test one of the authors was returned as N/A when the code below actually worked.


function extractAuthorInfo() {
    // This selector for byline authors is stable and does not need changes.
    const bylineAuthors = [...document.querySelectorAll('#bylineInfo .author a.a-link-normal')]
        .map(a => cleanText(a.textContent))
        .filter(Boolean);

    // Use a more robust selector for the main author card container.
    // It combines a stable part of the ID with a stable part of the class name.
    const authorCard = document.querySelector('div[id^="CardInstance"][class*="_about-the-author-card_style_cardParentDiv"]');
    
    let biography = null, imageUrl = null, cardAuthorName = null;

    if (authorCard) {
        // Extract biography using a selector that ignores the unique hash.
        biography = getText(authorCard, 'div[class*="_peekableContent"]');
        if (biography?.includes("Discover more of the author's books")) {
            biography = null;
        }
        
        // Extract image URL using a stable class selector.
        imageUrl = getAttr(authorCard, 'img[class*="_authorImage"]', 'src');

        // Extract the author's name using a more specific and stable selector, avoiding generic tags like 'h2'.
        cardAuthorName = getText(authorCard, 'div[class*="_authorName"] a');
    }
    
    // Prioritize byline authors if they exist, otherwise use the name from the card.
    const authorName = bylineAuthors.length > 0 ? bylineAuthors.join(', ') : cardAuthorName;
    
    if (!authorName) return null;
    
    // Check if the image is the default placeholder.
    const validImage = imageUrl && imageUrl !== "https://m.media-amazon.com/images/I/01Kv-W2ysOL._SY600_.png";
    
    // Count words in the biography.
    const bioWordCount = biography ? biography.trim().split(/\s+/).length : 0;
    
    return { 
        name: authorName, 
        biography, 
        imageUrl, 
        validImage, 
        bioWordCount 
    };
}