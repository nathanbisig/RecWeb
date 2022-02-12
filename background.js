console.log("Background Started");

const MAX_PAGE_LENGTH = 1000000;
const BASE_MINIMUM_REPEATS = 3;
var stopwords = ['i','also','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now']

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        var pageText = request.pageText;
        SaveRecommendations();
        if(pageText.length != null && pageText.length > 0){
            var repeatFile = ProcessPage(pageText);
            console.log(repeatFile);
            sendResponse({status: "[Success\nSize: " + pageText.length + 
            "\nSummary: \"" + pageText.substring(0,100) + "...\"\nMost Used Words: " + printRepeatFile(repeatFile) + " ]"});
        }
        else{
            sendResponse({status: "Failure"});
        }
    }
  );

function printRepeatFile(repeatFile){
    str = "\"";
    for(let i = 0; i < repeatFile.length && i <10; i++){
        str = str + repeatFile[0].word + "\":" + repeatFile[0].count + ", \""; 
    }
    return str.substring(0,str.length-3);
}

function ProcessPage(pageText){
    title = pageText.substring(0,3);
    console.log("Processing page \"" + pageText.substring(0,3) + "\"");
    console.log(title +" - " + pageText.length + " chars");

    //Truncate page if needed
    if(pageText.length > MAX_PAGE_LENGTH){
        console.log("Truncating page...");
        pageText = pageText.substring(0,MAX_PAGE_LENGTH);
        console.log(title +" - " + pageText.length + " chars");
    }

    //Remove punctuation
    console.log("Removing punctuation...");
    pageText = pageText.replace(/[.,\/#|!—™“”›$%\^&\*;–:{}=\-_`~()?]/g,"");
    pageText = pageText.replace(/[\[\]]/g," ");
    pageText = pageText.replace(/(\r\n|\n|\r|\"|\t)/gm, " ");
    console.log(title +" - " + pageText.length + " chars");

    //All lowercase
    console.log("To Lower...");
    pageText = pageText.toLowerCase();

    //Remove stop words
    console.log("Removing stopwords...");
    pageText = removeStopwords(pageText);
    console.log(title +" - " + pageText.length + " chars");

    //Generate word array
    console.log("Generate word array...");
    pageWords = pageText.split(" ");
    console.log(title +" - " + pageWords.length + " words");

    //Remove empty words
    console.log("Remove Empty Words...");
    pageWords = pageWords.filter(wordFilter);
    console.log(title +" - " + pageWords.length + " words");

    //Generate frequency
    console.log("Generate Frequency array...");
    const wordFrequency = [];
    for (const word of pageWords) {
        object = wordFrequency.find(obj => {return obj.word === word});
        if (object == undefined) {
            wordFrequency.push({word: word, count: 1});
        } else {
            object.count++;
        }
    }
    console.log(title +" - " + wordFrequency.length + " uniques");

    //Generate frequency n-2
    console.log("Generate frequency array n =2...");
    const wordFrequencyN2 = [];
    for (let i = 0; i < pageWords.length - 2; i++) {
        word = pageWords[i] + " " + pageWords[i+1];
        object = wordFrequencyN2.find(obj => {return obj.word === word});
        if (object == undefined) {
            wordFrequencyN2.push({word: word, count: 1});
        } else {
            object.count++;
        }
    }
    console.log(title +" - " + wordFrequencyN2.length + " n=2 uniques");

    //Generate Repeats
    console.log("Generate repeats...");
    repeats = wordFrequency.filter(repeatFilter);
    console.log(title +" - " + repeats.length + " repeats");
    repeatsN2 = wordFrequencyN2.filter(repeatFilter);
    console.log(title +" - " + repeatsN2.length + " n=2 repeats");

    //Combine Frequency arrays
    console.log("Combine Frequency arrays...");
    repeats = repeats.concat(repeatsN2);
    console.log(title +" - " + repeats.length + " repeats");
    
    //Sort
    console.log("Sorting...");
    repeats.sort((a, b) => {
        return b.count - a.count;
    });
    console.log(title +" - " + repeats.length + " repeats");
    return repeats
}

function removeStopwords(str) {
    res = []
    words = str.split(' ')
    for(i=0;i<words.length;i++) {
       word_clean = words[i].split(".").join("")
       if(!stopwords.includes(word_clean)) {
           res.push(word_clean)
       }
    }
    return(res.join(' '))
}  

function wordFilter(word) {
    if(word != "" && word != " "){
        return true;
    }
    return false;
  }

  function repeatFilter(obj) {
    if(obj.count > BASE_MINIMUM_REPEATS-1){
        return true;
    }
    return false;
  }

function CollectDocuments(){
    var documents = [[],[]];
    documents = chrome.storage.sync.get("key",function(res) {
        console.log(documents.count)
        });
}

function FindSearches(){
    console.log();
}

function FindRecommendations(){
    console.log();
}

function SaveRecommendations(){
    chrome.storage.sync.set({"rec1":"www.google.com"});
}