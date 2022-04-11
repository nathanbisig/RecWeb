// #region Config
const MAX_PAGE_LENGTH = 1000000;
const BASE_MINIMUM_REPEATS = 10;
const MAX_FILES = 6;
var stopwords = ['i','also','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now','·','»','   '];

const DEBUG_MAX_WORDS = 10;
// #endregion


// #region Startup
console.log("Background Started");
chrome.storage.local.clear(
    function() {
        var error = chrome.runtime.lastError;
        if (error) { console.log(error); }
        else{ console.log("Local storage clear"); }
    }
);
// #endregion


// #region Main
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {

        console.log("Background recieved command: " + request.command);

        if(request.command === "PROCESS_PAGE")
        {
            ExecuteProcessPage(request).then(sendResponse);
        }
        else if(request.command === "GET_RECOMMENDATIONS")
        {
            ExecuteGetRecommendations(request).then(sendResponse);
        }
        else
        {
            sendResponse({command: "No command was sent", status: "Failure"});
        }

        return true;
    }
);
// #endregion

  
// #region Processing
async function ExecuteProcessPage(request){
    try{
        var pageText = request.pageText;
        if(pageText.length != null && pageText.length > 0){

            var file = ProcessPage(pageText);

            if(file != null && file != undefined)
            {
                await SaveFile(file);

                var recommendations = await GenerateRecommendations();

                await setStorageData({ "RecWebRecs": recommendations });

                return({status: "Success", 
                    size: pageText.length,
                    summary: pageText.substring(0,100),
                    uniques: file.length,
                    mostUsedWords: file.slice(0,DEBUG_MAX_WORDS)});
                }
            else
            {
                return({status: "Failure", 
                    message: "RecWeb - file was null."});
            }
        }
        else{
            return({status: "Failure", 
                message: "RecWeb - No text was found."});
        }
    }
    catch(error){
        return({status: "Failure", 
            message: "RecWeb - " + error});
    }
}
// #endregion


// #region Get Recommendations
async function ExecuteGetRecommendations(request){
    var recommendations = await getStorageData('RecWebRecs');

    console.log(recommendations);

    if(recommendations != null && recommendations != undefined)
    {
        return({command: "GET_RECOMMENDATIONS", 
            status: "Success", 
            recommendations: recommendations });
    }
    else
    {
        return({command: "GET_RECOMMENDATIONS", 
            status: "Failure", 
            recommendations: [
                {title: "", link: "", snippet: "No recommendations yet. Keep searching!"}]});
    }
}
// #endregion


// #region Preprocessing
function ProcessPage(pageText){
    title = pageText.substring(0,3);

    //Truncate page if needed
    if(pageText.length > MAX_PAGE_LENGTH){
        console.log("Truncating page...");
        pageText = pageText.substring(0,MAX_PAGE_LENGTH);
        console.log(title +" - " + pageText.length + " chars");
    }

    //Remove punctuation
    pageText = pageText.replace(/[.,\/#|!—™“”›$%\^&\*;–:{}=\-_`~()?]/g,"");
    pageText = pageText.replace(/[\[\]]/g," ");
    pageText = pageText.replace(/(\r\n|\n|\r|\"|\t)/gm, " ");

    //All lowercase
    pageText = pageText.toLowerCase();

    //Remove stop words
    pageText = removeStopwords(pageText);

    //Generate word array
    pageWords = pageText.split(" ");

    //Remove empty words
    pageWords = pageWords.filter(wordFilter);

    //Generate frequency n=1
    const wordFrequency = [];
    for (const word of pageWords) {
        object = wordFrequency.find(obj => {return obj.word === word});
        if (object == undefined) {
            wordFrequency.push({word: word, count: 1});
        } else {
            object.count++;
        }
    }

    //Generate frequency n=2
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

    //Generate frequency n=3
    const wordFrequencyN3 = [];
    for (let i = 0; i < pageWords.length - 2; i++) {
        word = pageWords[i] + " " + pageWords[i+1] + " " + pageWords[i+2];
        object = wordFrequencyN3.find(obj => {return obj.word === word});
        if (object == undefined) {
            wordFrequencyN3.push({word: word, count: 1});
        } else {
            object.count++;
        }
    }

    //Generate frequency n=4
    const wordFrequencyN4 = [];
    for (let i = 0; i < pageWords.length - 2; i++) {
        word = pageWords[i] + " " + pageWords[i+1] + " " + pageWords[i+2] + " " + pageWords[i+3];
        object = wordFrequencyN4.find(obj => {return obj.word === word});
        if (object == undefined) {
            wordFrequencyN4.push({word: word, count: 1});
        } else {
            object.count++;
        }
    }

    //Remove words under a certain amount of repeats
    repeats = wordFrequency.filter(repeatFilter);
    repeatsN2 = wordFrequencyN2.filter(repeatFilter);
    repeatsN3 = wordFrequencyN3.filter(repeatFilter);
    repeatsN4 = wordFrequencyN4.filter(repeatFilter);

    //Combine Frequency arrays
    repeats = repeats.concat(repeatsN2);
    repeats = repeats.concat(repeatsN3);
    repeats = repeats.concat(repeatsN4);
    
    //Sort
    repeats.sort((a, b) => {
        return b.count - a.count;
    });

    //calculate TermFrequency
    for(i=0; i<repeats.length; i++)
    {
        repeats[i].termFrequency = repeats[i].count / pageWords.length;
    }

    return repeats;
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
// #endregion


// #region Recomendation Engine

async function GenerateRecommendations(){
    var files = await RetrieveFiles();

    var wordInfo = [];
    for(i=0; i<files.length; i++)
    {
        for(j=0; j<files[i].length; j++)
        {
            object = wordInfo.find(obj => {return obj.word === files[i][j].word});
            if (object == undefined) {

                var documents = [{id: i, count: files[i][j].count, frequency: files[i][j].termFrequency, TfIdf: 0}];
                var item = {word: files[i][j].word, documents: documents, score_raw: 0, score_frequency: 0};
                wordInfo.push(item);
            } else {
                var document = {id: i, count: files[i][j].count, frequency: files[i][j].termFrequency, TfIdf: 0};
                object.documents.push(document);
            }
        }
    }

    for(i=0; i<wordInfo.length; i++)
    {
        for(j=0; j<wordInfo[i].documents.length; j++)
        {
            wordInfo[i].documents[j].tfIdf = wordInfo[i].documents[j].frequency * Math.log(files.length / wordInfo[i].documents.length)
        }
    }

    for(i=0; i<wordInfo.length; i++)
    {
        var score = 0;
        for(j=0; j<wordInfo[i].documents.length; j++)
        {
            score += wordInfo[i].documents[j].frequency * (1/((files.length - wordInfo[i].documents[j].id)-.99)) + 1;
        }
        wordInfo[i].score_frequency = score;
    }

    for(i=0; i<wordInfo.length; i++)
    {
        var score = 0;
        for(j=0; j<wordInfo[i].documents.length; j++)
        {
            score += wordInfo[i].documents[j].count * 1 + (1/((files.length - wordInfo[i].documents[j].id)-.99)) + 1;
        }
        wordInfo[i].score_raw = score;
    }

    wordInfo.sort((a, b) => {
        return b.score_frequency - a.score_frequency;
    })

    console.log("--Word Info FREQUENCY--");
    console.log(wordInfo.slice(0, 10));
    console.log("----");

    wordInfo.sort((a, b) => {
        return b.score_raw - a.score_raw;
    })

    console.log("--Word Info RAW--");
    console.log(wordInfo.slice(0, 10));
    console.log("----");

 

    var bestWords = [];
    for(i = 0; i < wordInfo.length && i < 0; i++)
    {
        bestWords.push(wordInfo[i].word);
    }
    console.log(bestWords);

    var xmlResult;
    var recommendations = [];
    for(i = 0; i < bestWords.length; i++){
        xmlResult = await makeRequest("GET", "https://api.valueserp.com/search?api_key=8DEE36D56BE64E608E1357BED89B946E&q="+bestWords[i]+"&hl=en");
        jsonResult = JSON.parse(xmlResult);
        recommendations = recommendations.concat(jsonResult.organic_results)
    }

    console.log(recommendations);

    return recommendations;
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
// #endregion


// #region Storage
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

// #endregion


// #region Helpers
const average = arr => arr.reduce((a,b) => a + b, 0) / arr.length;
// #endregion


// #region Depricated
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

function dreplaceAll(string, search, replace) {
    return string.split(search).join(replace);
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
// #endregion