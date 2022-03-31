console.log("Background Started");
chrome.storage.local.clear(function() {
    var error = chrome.runtime.lastError;
    if (error) {
        console.log(error);
    }
    console.log("Local storage clear");
});

const MAX_PAGE_LENGTH = 1000000;
const BASE_MINIMUM_REPEATS = 10;
const MAX_FILES = 6;
var stopwords = ['i','also','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now','·']

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {

        console.log("Background recieved command: " + request.command);

        if(request.command === "PROCESS_PAGE"){
            ExecuteProcessPage(request).then(sendResponse);
        }
        else if(request.command === "GET_RECOMMENDATIONS"){
            ExecuteGetRecommendations(request).then(sendResponse);
        }
        else{
            sendResponse({command: "No command was sent", status: "Failure"});
        }

        return true;
    }
  );

async function ExecuteProcessPage(request){
    var pageText = request.pageText;
    if(pageText.length != null && pageText.length > 0){

        var file = ProcessPage(pageText);
        console.log("--Processed Page--");
        console.log(file);
        console.log("----");



        await SaveFile(file);
        //sendResponse({status: "[Success\nSize: " + pageText.length + 
        //"\nSummary: \"" + pageText.substring(0,100) + "...\"\nMost Used Words: " + printRepeatFile(repeatFile) + " ]"});

        var recommendations = await GenerateRecommendations();
        console.log(recommendations);

        await setStorageData({ "RecWebRecs": recommendations });
        return({command: "PROCESS_PAGE", status: "Success"});
    }
    else{
        return({command: "PROCESS_PAGE", status: "Failure"});
    }
}

async function ExecuteGetRecommendations(request){
    var x = await getStorageData('RecWebRecs');
    console.log(x);
    if(x != null && x != undefined){
        return({command: "GET_RECOMMENDATIONS", status: "Success", 
        recommendations: x });
    }
    else{
        return({command: "GET_RECOMMENDATIONS", status: "Failure", 
        recommendations: [
            {label: "", link: "", text: "Sorry, there was an error."}]});
    }
    
}


function printRepeatFile(repeatFile){
    str = "\"";
    for(let i = 0; i < repeatFile.length && i < 10; i++){
        str = str + repeatFile[i].word + "\":" + repeatFile[i].count + ", \""; 
    }
    return str.substring(0,str.length-3);
}

function ProcessPage(pageText){
    title = pageText.substring(0,3);
    //console.log("Processing page \"" + pageText.substring(0,3) + "\"");
    //console.log(title +" - " + pageText.length + " chars");

    //Truncate page if needed
    if(pageText.length > MAX_PAGE_LENGTH){
        console.log("Truncating page...");
        pageText = pageText.substring(0,MAX_PAGE_LENGTH);
        console.log(title +" - " + pageText.length + " chars");
    }

    //Remove punctuation
    //console.log("Removing punctuation...");
    pageText = pageText.replace(/[.,\/#|!—™“”›$%\^&\*;–:{}=\-_`~()?]/g,"");
    pageText = pageText.replace(/[\[\]]/g," ");
    pageText = pageText.replace(/(\r\n|\n|\r|\"|\t)/gm, " ");
    //console.log(title +" - " + pageText.length + " chars");

    //All lowercase
    //console.log("To Lower...");
    pageText = pageText.toLowerCase();

    //Remove stop words
    //console.log("Removing stopwords...");
    pageText = removeStopwords(pageText);
    //console.log(title +" - " + pageText.length + " chars");

    //Generate word array
    //console.log("Generate word array...");
    pageWords = pageText.split(" ");
    //console.log(title +" - " + pageWords.length + " words");

    //Remove empty words
    //console.log("Remove Empty Words...");
    pageWords = pageWords.filter(wordFilter);
    //console.log(title +" - " + pageWords.length + " words");

    //Generate frequency
    //console.log("Generate Frequency array...");
    const wordFrequency = [];
    for (const word of pageWords) {
        object = wordFrequency.find(obj => {return obj.word === word});
        if (object == undefined) {
            wordFrequency.push({word: word, count: 1});
        } else {
            object.count++;
        }
    }
    //console.log(title +" - " + wordFrequency.length + " uniques");

    //Generate frequency n-2
    //console.log("Generate frequency array n =2...");
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
    //console.log(title +" - " + wordFrequencyN2.length + " n=2 uniques");

    //Generate Repeats
    //console.log("Generate repeats...");
    repeats = wordFrequency.filter(repeatFilter);
    //console.log(title +" - " + repeats.length + " repeats");
    repeatsN2 = wordFrequencyN2.filter(repeatFilter);
    //console.log(title +" - " + repeatsN2.length + " n=2 repeats");

    //Combine Frequency arrays
    //console.log("Combine Frequency arrays...");
    repeats = repeats.concat(repeatsN2);
    //console.log(title +" - " + repeats.length + " repeats");
    
    //Sort
    //console.log("Sorting...");
    repeats.sort((a, b) => {
        return b.count - a.count;
    });

    //calculate TermFrequency
    for(i=0; i<repeats.length; i++)
    {
        repeats[i].termFrequency = repeats[i].count / pageWords.length;
    }
    //console.log(title +" - " + repeats.length + " repeats");
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

async function GenerateRecommendations(){
    //console.log("Generating Recommendations");
    var files = await RetrieveFiles();

    console.log(files);

    var wordInfo = [];
    // {word, totalNumber, totalFrequency, FrequencyByPage[], docFrequency, docs[], idf, tfIdf}
    for(i=0; i<files.length; i++)
    {
        for(j=0; j<files[i].length; j++)
        {
            object = wordInfo.find(obj => {return obj.word === files[i][j].word});
            if (object == undefined) {
                var frequencyByPage = [files[i][j].termFrequency];
                var docs = [i];
                var item = {word: files[i][j].word, totalNumber: files[i][j].count, frequencyByPage: frequencyByPage, docFrequency: 1, docs: docs, idf: 0, tfIdf: [], score:0};
                wordInfo.push(item);
            } else {
                object.totalNumber += files[i][j].count;
                object.frequencyByPage.push(files[i][j].termFrequency);
                object.docFrequency++;
                object.docs.push(i);
            }
        }
    }

    for(i=0; i<wordInfo.length; i++)
    {
        wordInfo[i].idf = Math.log(files.length / wordInfo[i].docFrequency);
        for(j=0; j<wordInfo[i].frequencyByPage.length; j++)
        {
            wordInfo[i].tfIdf.push(wordInfo[i].frequencyByPage[j] * wordInfo[i].idf);
        }
    }

    var totalWords = 0;
    for(i=0; i<wordInfo.length; i++)
    {
        totalWords += wordInfo[i].totalNumber;
    }

    for(i=0; i<wordInfo.length; i++)
    {
        wordInfo[i].score = average(wordInfo[i].tfIdf) * (wordInfo[i].totalNumber / totalWords);
    }

    wordInfo.sort((a, b) => {
        return b.score - a.score;
    })

    console.log("--Word Info--");
    console.log(wordInfo.slice(0, 10));
    console.log("----");

    var bestWords = [];
    for(i = 0; i < wordInfo.length && i < 10; i++)
    {
        bestWords.push(wordInfo[i].word);
    }
    console.log(bestWords);

    var xmlResult;
    var anchorPts;
    var labels = [];
    var links = [];
    var texts = [];
    var recommendations = [];
    for(i = 0; i < bestWords.length; i++){
        xmlResult = await makeRequest("GET", "https://www.google.com/search?q="+bestWords[i]);
        anchorPts = getIndicesOf('<br><h3', xmlResult);
        for(j=0; j<1; j++){
            labels.push(ExtractLabel(anchorPts[j],xmlResult));
            links.push(ExtractLink(anchorPts[j],xmlResult));
            texts.push(ExtractText(anchorPts[j],xmlResult));
        }
    }

    for(i = 0; i < labels.length; i++){
        recommendations.push({label: labels[i], link: links[i], text: texts[i]})
    }

    return recommendations;
}

function ExtractLabel(index, text){
    var label = '';
    var foundGreaterThan = false;
    var foundLessThan = false;
    var next = index+7;
    while(!foundLessThan && next - index < 100){
        if(foundGreaterThan){
            if(text[next] == "<"){
                foundLessThan = true;
            }
            else{
                label = label + text[next];
            }
        }
        else if(text[next] == ">"){
            foundGreaterThan = true;
        }
        next++;
    }

    label = replaceAll(label,'&#39;','\'');
    label = replaceAll(label,'&amp;','&');
    return label;
}
function ExtractLink(index, string){
    var link = '';
    var foundBeg = false;
    var foundEnd = false;
    var beg;
    var end;
    var next = index;
    while(!foundBeg && index - next < 1000){
        if(string[next] == "\"" 
         && string[next-1] == "="
         && string[next-2] == "f"
         && string[next-3] == "e"
         && string[next-4] == "r"){
            foundBeg = true;
            beg = next+1;
        }
        next--;
    }
    while(!foundEnd && next - index < 5000){
        if(string[next] == "\"" 
         && string[next+1] == " "){
            foundEnd = true;
            end = next;
        }
        next++;
    }

    if(!foundBeg || !foundEnd){
        return '';
    }
    else{
        link = string.substring(beg,end);
        return link;
    }
}
function ExtractText(index, string){
    var substring = string.substring(index);
    var emAnchor = substring.search("<em>");
    var text = '';
    var foundBeg = false;
    var foundEnd = false;
    var beg;
    var end;
    var next = emAnchor;
    while(!foundBeg && emAnchor - next < 1000){
        if(substring[next] == ">" && substring[next-1] == "n"){
            foundBeg = true;
            beg = next+1;
        }
        next--;
    }
    next = emAnchor;
    while(!foundEnd && next - emAnchor < 1000){
        if(substring[next] == "<" && substring[next+1] == "/" && substring[next+2] == "s"){
            foundEnd = true;
            end = next;
        }
        next++;
    }

    if(!foundBeg || !foundEnd){
        return '';
    }
    else{
        text = substring.substring(beg,end);
        text = replaceAll(text,'<em>','');
        text = replaceAll(text,'</em>','');
        text = replaceAll(text,'&#39;','\'');
        text = replaceAll(text,'&amp;','&');
        return text;
    }
}

function replaceAll(string, search, replace) {
    return string.split(search).join(replace);
  }

function makeRequest(method, url) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
}

function getIndicesOf(searchStr, str) {
    var searchStrLen = searchStr.length;
    if (searchStrLen == 0) {
        return [];
    }
    var startIndex = 0, index, indices = [];
    while ((index = str.indexOf(searchStr, startIndex)) > -1) {
        indices.push(index);
        startIndex = index + searchStrLen;
    }
    return indices;
}


async function SaveFile(file){
    if(file.length > 0)
    {
        var recWebFiles = await getStorageData('RecWebFiles')
        //console.log(recWebFiles);
        if(recWebFiles == undefined || recWebFiles == null){
            //console.log("Save File - und");
            recWebFiles = [file];
            await setStorageData({ "RecWebFiles": recWebFiles });
        }
        else{
            console.log("Files in storage is "+ recWebFiles.length)
            if(recWebFiles.length > MAX_FILES - 1)
            {
                recWebFiles = recWebFiles.slice(-9);
            }
            recWebFiles.push(file);
            await setStorageData({ "RecWebFiles": recWebFiles });
        }
    }
}

async function RetrieveFiles(){
    var recWebFiles = await getStorageData('RecWebFiles')
    if(recWebFiles == undefined){
        //console.log("RetrieveFiles - und");
        return null;
    }
    else{
        //console.log("RetrieveFiles - Success");
        //console.log(recWebFiles);
        return recWebFiles;
    }
}

const average = arr => arr.reduce((a,b) => a + b, 0) / arr.length;

const getStorageData = key =>
  new Promise((resolve, reject) =>
    chrome.storage.local.get(key, result =>
      chrome.runtime.lastError
        ? reject(Error(chrome.runtime.lastError.message))
        : resolve(result[key])
    )
  )

const setStorageData = data =>
  new Promise((resolve, reject) =>
    chrome.storage.local.set(data, () =>
      chrome.runtime.lastError
        ? reject(Error(chrome.runtime.lastError.message))
        : resolve()
    )
  )