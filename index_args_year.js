let querystring = require('querystring'),
    http = require('http'),
    jsdom = require("node-jsdom"),
    pdf = require('html-pdf'),
    fs = require('fs'),
    path = require('path'),
    async = require('async');

let apiConfig = {
  host: 'www.prajavani.net',
  archivePath: '/mobile/archive',
  articlePath: '/news',
};

let createDir = (dirPath, mode, callback) => {
  fs.mkdir(dirPath, mode,  (error) => {
    if (error && error.code === 'ENOENT'){
      createDir(path.dirname(dirPath), mode, createDir.bind(this,dirPath,mode,callback));
  }else
    if (callback)
    callback(error);
  });
};

let createPdf = (title, data, name) => {
  let dirName = name.split('-')[0];
  let pathName = `articles/${dirName}`
  if (!fs.existsSync(pathName)){
      createDir(pathName)
  }

  pdf.create(data).toStream((err, stream) => {
    stream.pipe(fs.createWriteStream(`${pathName}/${name}-${title}.pdf`));
  });
}

let extractContentFromHtml = (title, html, dirName) => {
  jsdom.env(html, (err, window) => {
    let documentEl = window.document,
        holderEl = documentEl.querySelector('body .container #main_container #article_section .article_body'),
        author = holderEl.querySelector('.article_author'),
        date = holderEl.querySelector('.article_date'),
        summary = holderEl.querySelector('.article_summary'),
        thumbnail = holderEl.querySelector('.article_image'),
        content = holderEl.querySelector('.body'),
        gallery = holderEl.querySelector('.my-gallery');

    let data = `<h1>${(title === null)? '' : title}</h1>
                ${(author === null)? '' : author.outerHTML}
                ${(date === null)? '' : date.outerHTML}
                ${(summary === null)? '' : summary.outerHTML}
                ${(thumbnail === null)? '' : thumbnail.outerHTML}
                ${(content === null)? '' : content.outerHTML}
                ${(gallery === null)? '' : gallery.outerHTML}`;

    createPdf(title, data, dirName);

  });
}

let fetchPlaceData = (place, dirName) => {
  let { title, url } = place;
  let options = {
    host: apiConfig.host,
    path: `${apiConfig.articlePath}${url}`
  }

  http.request(options, (response)=>{
    let placeData = [];
    response.on('data', (chunk) => {
      placeData.push(chunk);
    });

    response.on('end', () => {
      placeData = Buffer.concat(placeData).toString();
      extractContentFromHtml(title, placeData, dirName);
    });
  }).end();
}

let placeExtractor = (places, dirName) => {
  for(let i=0; i<places.length; i++){
    fetchPlaceData(places[i], dirName)
  }
}

let parseArchiveData = (data, date) => {
  let jsonData = JSON.parse(data, null, 2);
  let category = 'ಪ್ರವಾಸ';
  if(jsonData.hasOwnProperty(category)){
    let placesInfo = jsonData[category];
    placeExtractor(placesInfo, date);
    console.log(`Got ${placesInfo.length} places in ${date}`);
  }else{
    //console.log(`Sorry !! No ${category} Article on this day`);
  }
}

let fetchArchiveData = (y, m, d) => {
  let date = getDateFormat(y, m, d);
  let params = querystring.stringify({arcDate: date});
  let options = {
    host: apiConfig.host,
    path: apiConfig.archivePath,
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params)
    }
  }
  let request = http.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => {
          data += chunk.toString();
      });
      response.on('end', () => {
        parseArchiveData(data, date);
      });
  });
  request.write(params);
  request.end();
}

let getDateFormat = (year, monthDigit, dayDigit) => {
  let month = (monthDigit < 10)? '0'+monthDigit : ''+monthDigit;
  let day = (dayDigit < 10)? '0'+dayDigit : ''+dayDigit;
  return `${year}-${month}-${day}`;
}

let getNumberofDays = (year, month) => {
  return new Date(year, month, 0).getDate();
}

let initializeApp = () => {
  let year = process.argv[2];
  let totalMonths = 12;
  let month = 1;
  let delay = setInterval(() => {
      let days = getNumberofDays(year, month);
      for(let i=1; i<=days; i++){
        fetchArchiveData(year, month, i);
      }
      console.log(`------- Processing ------- for the month ${month}-${year}`);
      if(month !== totalMonths){
        month++;
      }else{
        console.log(`Pdf files are saved with respective Dates`);
        clearInterval(delay)
      }
    }, 15000);
}

initializeApp();
