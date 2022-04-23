// #region Config
const MAX_PAGE_LENGTH = 1000000;
const BASE_MINIMUM_REPEATS = 2;
const MAX_FILES = 30;
var stopwords = ['i','also','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now','·','»','   '];
// #endregion

console.log("Background Started");
chrome.storage.local.clear(
    function() {
        var error = chrome.runtime.lastError;
        if (error) { console.log(error); }
        else{ console.log("Local storage clear"); }
    }
);


// #region Main
    // This method is the entry point to the background script.
    // The background script can be asked to process a page and generate the 
    // subsequent recommendations or retrieve the recommendations
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {

        console.log("Background recieved command: " + request.command);

        if(request.command === "PROCESS_PAGE")
        {
            ExecuteProcessPage(request.pageText, request.pageUrl).then(sendResponse);
        }
        else if(request.command === "GET_RECOMMENDATIONS")
        {
            ExecuteGetRecommendations().then(sendResponse);
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
async function ExecuteProcessPage(pageText, pageUrl){
    try{
        if(pageText.length != null && pageText.length > 0){
            var file = ProcessPage(pageText);
            if(file != null && file != undefined)
            {
                //Determine whether this page has already been processed
                var alreadyHavePage = await AlreadyHavePage(pageUrl);
                if(!alreadyHavePage)
                {
                    await SaveFile(file);
                    await SaveUrl(pageUrl);
    
                    //Generate Recommendations based on current page
                    await GenerateRecommendationsShort(file);
    
                    //Generate Recommendations based on past pages
                    GenerateRecommendationsLong();
    
                    return({status: "Success"});
                }
                else
                {
                    //Generate Recommendations based on current page
                    await GenerateRecommendationsShort(file);

                    return({status: "Success"});
                }
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

async function AlreadyHavePage(url)
{
    var pageIds = await RetrievePageIds();
    if(pageIds == null)
    {
        return false;
    }
    if(pageIds.includes(url))
    {
        return true;
    }
    return false;
}
// #endregion


// #region Get Recommendations
async function ExecuteGetRecommendations(){
    console.log("ExecuteGetRecommendations");

    var recommendations = [];
    var randomNumber = 0;

    var recommendationsShort = await getStorageData('RecWebRecsShort');
    if(recommendationsShort != null && recommendationsShort != undefined)
    {
        while(recommendations.length<5 && recommendationsShort.length>0)
        {
            randomNumber = getRandomInt(recommendationsShort.length);
            if(!recommendations.includes(recommendationsShort[randomNumber]) && recommendationsShort[randomNumber] != undefined)
            {
                recommendations.push(recommendationsShort[randomNumber]);
            }
            else
            {
                recommendationsShort.splice(randomNumber,1);
            }
        }
    }

    var recommendationsLong = await getStorageData('RecWebRecsLong');
    if(recommendationsLong != null && recommendationsLong != undefined)
    {
        while(recommendations.length<15 && recommendationsLong.length>0)
        {
            randomNumber = getRandomInt(recommendationsLong.length);
            if(!recommendations.includes(recommendationsLong[randomNumber]) && recommendationsLong[randomNumber] != undefined)
            {
                recommendations.push(recommendationsLong[randomNumber]);
            }
            else
            {
                recommendationsLong.splice(randomNumber,1);
            }
        }
    }

    console.log("POPUP RECS");
    console.log(recommendations);

    if(recommendations != [])
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
    console.log("ProcessPage");
    title = pageText.substring(0,3);

    //Truncate page if it is needlessly long
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

    //Generate frequency n=2 (two-word phrases)
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

    //Generate frequency n=3 (three-word phrases)
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

    //Generate frequency n=4 (four-word phrases)
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
    if(word != "" && word != " " && word.length>1){
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
async function GenerateRecommendationsShort(file)
{
    console.log("Starting Short");

    search = FormSearch([file]);
    console.log("search: " + search);

    recommendations = await GetRecommendationsWithSearch([search]);
    console.log("SHORT recommendations\/ ");
    console.log(recommendations);

    await setStorageData({ "RecWebRecsShort": recommendations });
}

async function GenerateRecommendationsLong(){
    var files = await RetrieveFiles();

    //console.log("Raw Files");
    //console.log(files);
    //console.log("");

    if(files.length > 10)
    {
        var wordInfo = GenerateWordInfo(files);
    
        console.log("Word Info");
        console.log(wordInfo);
        console.log("");
    
        var tfIdfMatrix = FormatMatrix(files.length, wordInfo);
    
        console.log("tf-idf Matrix");
        console.log(tfIdfMatrix);
        console.log("");
    
        //generate kMeans INput
        var kMeansInput = [];
        for(var i=0; i < tfIdfMatrix.length; i++)
        {
            kMeansInput.push(tfIdfMatrix[i]);
        }
    
        //Run KMEANs 10 times for for 1-files.length+1 clusters
        kValues = []
        for(var i =1; i<(files.length/2)+1; i++) // Number of clusters
        {
            var clusterData = kmeans(kMeansInput, i);
            //console.log(clusterData);
            for(var j =0; j<9; j++) //try to get a better variance
            {
                var xclusterData = kmeans(kMeansInput, i);
                //console.log(xclusterData);
                if(clusterData.Variance > xclusterData.Variance)
                {
                    clusterData = xclusterData;
                }
            }
            kValues.push(clusterData);
        }
        console.log(kValues);

        //elbow method
        var ElbowSheet = {clusters: [], variance: [], d1: [], d2: [], strength: []};
        for(var i=0; i<kValues.length; i++)
        {
            ElbowSheet.clusters.push(kValues[i].clusters);
            ElbowSheet.variance.push(kValues[i].Variance);
            if(i>0)
            {
                ElbowSheet.d1.push(ElbowSheet.variance[i-1] - ElbowSheet.variance[i])
            }
            else
            {
                ElbowSheet.d1.push(-99)
            }
            if(i>1)
            {
                ElbowSheet.d2.push(ElbowSheet.d1[i-1] - ElbowSheet.d1[i])
            }
            else
            {
                ElbowSheet.d2.push(-99);
            }
        }

        ElbowSheet.strength.push(-99)
        for(var i=1; i<kValues.length-1; i++)
        {
            ElbowSheet.strength.push(ElbowSheet.d2[i+1] - ElbowSheet.d1[i+1])
        }
        ElbowSheet.strength.push(-99)

        //console.log(ElbowSheet);

        var maxElbowStrength = -99;
        var clustersFinal = kValues[0].clusterData;
        var clustersFinalNumber = 1;
        for(var i=0;i<ElbowSheet.strength.length;i++)
        {
            if(maxElbowStrength < ElbowSheet.strength[i])
            {
                maxElbowStrength = ElbowSheet.strength[i];
                clustersFinal = kValues[i].clusterData;
                clustersFinalNumber = kValues[i].clusters;
            }
        }

        console.log(clustersFinal);
        console.log(clustersFinalNumber);
        
        var searches = [];
        for(var i = 0; i<clustersFinalNumber;i++)
        {
            var clusterFiles = GetClusterFiles(files,clustersFinal,i);
            searches.push(FormSearch(clusterFiles));
        }
        console.log("searches: " + searches);

        var recommendations = await GetRecommendationsWithSearch(searches);

        console.log("LONG recommendations\\/ ")
        console.log(recommendations);

        await setStorageData({ "RecWebRecsLong": recommendations });
    }
}

async function GetRecommendationsWithSearch(searches)
{
    var recommendations = null;
    for(var i = 0; i<searches.length;i++)
    {
        var xmlResult = await makeRequest("GET", "https://api.valueserp.com/search?api_key=8DEE36D56BE64E608E1357BED89B946E&q="+searches[i]+"&hl=en");
        jsonResult = JSON.parse(xmlResult);
        console.log("raw");
        console.log(jsonResult.organic_results);
        if(recommendations == null)
        {
            recommendations = jsonResult.organic_results;
            console.log("before concat");
            console.log(recommendations);
        }
        else
        {
            for(var j = 0; j<jsonResult.organic_results.length;j++)
            {
                recommendations.push(jsonResult.organic_results[j]);
            }
            console.log("after concat");
            console.log(recommendations);
        }
    }
    return recommendations;
}

function FormSearch(files)
{
    //Generate wordInfo
    var wordInfo = GenerateWordInfo(files);

    //Sort
    wordInfo.sort((a, b) => {
        return b.count - a.count;
    });

    var popularWords = [];
    var add;
    for(i = 0; i < wordInfo.length && popularWords.length < 4; i++)
    {
        add = true;
        for(var j = 0; j < popularWords.length; j++)
        {
            if(add)
            {
                if(popularWords[j].includes(wordInfo[i].word))
                {
                    console.log("f " + popularWords[j] + " contains " + wordInfo[i].word);
                    add = false;
                }
                if(wordInfo[i].word.includes(popularWords[j]))
                {
                    console.log("r " + wordInfo[i].word + " contains " + popularWords[j]);
                    add = false;
                    popularWords[j] = wordInfo[i].word;
                }
            }
        }
        if(add)
        {
            popularWords.push(wordInfo[i].word);
        }
    }
    console.log(popularWords);

    var search = '';
    for(i = 0; i < popularWords.length; i++)
    {
        search = search + popularWords[i] + '+';
    }

    search = search.slice(0,search.length-1);
    return search;
}

function GetClusterFiles(files, clusters, cluster)
{
    var clusterFiles = [];
    for(var i=0; i<clusters.length; i++)
    {
        if(clusters[i] == cluster)
        {
            clusterFiles.push(files[i]);
        }
    }
    return clusterFiles;
}

function GenerateWordInfo(files)
{
    var wordInfo = [];
    for(i=0; i<files.length; i++)
    {
        for(j=0; j<files[i].length; j++)
        {
            object = wordInfo.find(obj => {return obj.word === files[i][j].word});
            if (object == undefined) {

                var documents = [{id: i, count: files[i][j].count, frequency: files[i][j].termFrequency, TfIdf: 0}];
                var item = {word: files[i][j].word, count: files[i][j].count, documents: documents};
                wordInfo.push(item);
            } else {
                var document = {id: i, count: files[i][j].count, frequency: files[i][j].termFrequency, TfIdf: 0};
                object.count += files[i][j].count;
                object.documents.push(document);
            }
        }
    }

    for(i=0; i<wordInfo.length; i++)
    {
        for(j=0; j<wordInfo[i].documents.length; j++)
        {
            wordInfo[i].documents[j].TfIdf = wordInfo[i].documents[j].frequency * Math.log(files.length / wordInfo[i].documents.length)
        }
    }

    return wordInfo;
}

function FormatMatrix(numOfDocs, wordInfo)
{
    var matrix = [];

    //initialize rows
    for(i=0; i < numOfDocs; i++)
    {
        matrix.push([]);
        for(j=0; j < wordInfo.length; j++)
        {
            matrix[i].push(0);
        }
    }

    var min = 10;
    var max = -10;
    //add values
    for(i=0; i < wordInfo.length; i++)
    {
        for(j=0; j<wordInfo[i].documents.length; j++)
        {
            if(wordInfo[i].documents[j].TfIdf < min)
            {
                min = wordInfo[i].documents[j].TfIdf;
            }
            if(wordInfo[i].documents[j].TfIdf > max)
            {
                max = wordInfo[i].documents[j].TfIdf;
            }
            matrix[wordInfo[i].documents[j].id][i] = wordInfo[i].documents[j].TfIdf;
        }
    }

    return matrix;
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
                recWebFiles = recWebFiles.slice(-(MAX_FILES-1));
            }
            recWebFiles.push(file);
            await setStorageData({ "RecWebFiles": recWebFiles });
        }
    }
}

async function SaveUrl(url){
    if(url.length > 0)
    {
        var pageIds = await getStorageData('PageIds')
        //console.log(pageIds);
        if(pageIds == undefined || pageIds == null){
            //console.log("Save File - und");
            pageIds = [url];
            await setStorageData({ "PageIds": pageIds });
        }
        else{
            console.log("PageIds in storage is "+ pageIds.length)
            if(pageIds.length > MAX_FILES - 1)
            {
                pageIds = pageIds.slice(-(MAX_FILES-1));
            }
            pageIds.push(url);
            await setStorageData({ "PageIds": pageIds });
        }
    }
}

async function RetrieveFiles(){
    var recWebFiles = await getStorageData('RecWebFiles')
    if(recWebFiles == undefined){
        return null;
    }
    else{
        return recWebFiles;
    }
}

async function RetrievePageIds(){
    var pageIds = await getStorageData('PageIds')
    if(pageIds == undefined){
        return null;
    }
    else{
        return pageIds;
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


// #region K-Means

function kmeans(data, config) {

    //initialize centroids with random data points
    var centroids = [];
    while(centroids.length < config)
    {
      var randomNumber = getRandomInt(data.length);
      if(!centroids.includes(data[randomNumber]))
      {
          centroids.push(data[randomNumber]);
      }
    } 

    //Assign data to clusters
    var clusterData_previous = updateClusters(data, centroids);

    //Perform max 10 kMeans iterations
    for(var i=0; i < 10; i++)
    {
        centroids = updateCentroids(data, clusterData_previous, centroids);
        clusterData = updateClusters(data, centroids);
        if(JSON.stringify(clusterData) === JSON.stringify(clusterData_previous))
        {
            break;
        }
        clusterData_previous = clusterData
    }

    //Calculate variance
    var variance = 0;
    for(var i=0; i<data.length;i++)
    {
        variance += cosSim(data[i],centroids[clusterData[i]]);
    }
    variance = (data.length - variance) / data.length;

    return {clusters: config, clusterData: clusterData, Variance: variance};
}

function updateClusters(data, centroids)
{
    var clusterData = [];
    for(var i=0; i<data.length; i++)
    {
        clusterData.push(99);
    }
    for(var i=0; i < data.length; i++)
    {
        var datum = data[i];
        var max = Number.MIN_SAFE_INTEGER ;
        for(var j=0; j< centroids.length; j++)
        {
            var sim = cosSim(datum,centroids[j]);
            if(sim > max)
            {
                clusterData[i] = j;
                max = sim;
            }
        }
    }
    return clusterData;
}

function updateCentroids(data, clusterData, centroids)
{
    var newCentroids = [];
    for(var i=0; i<centroids.length; i++)
    {
        var cluster = [];
        for(var j=0; j < data.length; j++)
        {
            if(clusterData[j] == i)
            {
                cluster.push(data[j]);
            }
        }

        var newCentroid = []
        for(var j=0; j < cluster[0].length; j++)
        {
            newCentroid.push(0);
        }
        for(var j=0; j < cluster.length; j++)
        {
            for(var k=0; k < cluster[0].length; k++)
            {
                newCentroid[k] += cluster[j][k];
            }
        }
        for(var j=0; j<newCentroid.length; j++)
        {
            newCentroid[j] = newCentroid[j] / cluster.length;
        }
    
        newCentroids.push(newCentroid);
    }
    return newCentroids;
}

//Cosine Similarity function which ranges from 0-1 (1 being most similar)
function cosSim(a,b)
{
    var dotp = 0;
    var maga = 0
    var magb = 0;
    for (var i = 0; i < a.length; i++) 
    {
        dotp += a[i] * b[i];
        maga += Math.pow(a[i], 2);
        magb += Math.pow(b[i], 2);
    }
    maga = Math.sqrt(maga);
    magb = Math.sqrt(magb);
    var d = dotp / (maga * magb);
    return d == Infinity ? 0 : d;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

// #endregion