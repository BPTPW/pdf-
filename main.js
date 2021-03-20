//编写时使用的是https加密，请自行将.key文件以及.pem文件根目录下的https文件夹，如果不需要，请将第二行的https改为http
var http = require('https');
var fs = require('fs');
var url = require('url');
var querystring = require('querystring');
var exe = require('exe');
var zipper = require("zip-local");

const POST = 444;

var number = 1;
var dpi=100;
var type=2;

// Configuare https
var httpsOption;
try{
    httpsOption = {
        key : fs.readFileSync("./https/https.key"),
        cert: fs.readFileSync("./https/https.pem")
    }
}catch(e){
    console.log('cannot get key file' + e);
    http = require('http');
}

delFileInTmp();

var webService = http.createServer(httpsOption,function(req,res){
    req.setEncoding('binary');
    var postData = ''; 
    // 数据块接收中
    req.addListener("data", function (chunk) {
        postData += chunk;
    });
    // 数据接收完毕，执行回调函数
    req.addListener("end", function () {
        var params = querystring.parse(postData.toString());
        var obj = url.parse(req.url,true);
        var pathname = obj.pathname;
        console.log('getReq:'+pathname);
        if(pathname == '/'){
            fs.readFile('./index.html',function(err,data){
                if(err){
                    console.error('file open error:'+err);
                    res.statusCode = 404;
                    res.statusMessage = 'not found';
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.write('404 not found 您所访问的文件暂时无法显示，您可以刷新重试');
                    res.end();
                }else{
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    var file = data;
                    res.write(file);
                    res.end();
                }
            });
        }else if(pathname == '/conversion'){
            //var filedata = base64ToString(params.file);
            let getFileErr = false;
            try{
                var fileData = parseFile(postData,req);
                getFileErr = false;
            }catch(e){
                console.log(e);
                getFileErr = true;
            }
            if(!getFileErr){
                console.log('length:'+fileData.length);

                let WriteErr = false;
                try{
                    fs.writeFileSync('./tmp/' + number + '.pdf', fileData , "binary");
                }catch(e){
                    console.error('cannot write the file: ' + e);
                    WriteErr = true;
                }
                if(!WriteErr){
                    console.log('the file is in ./tmp/' + number + '.pdf');
                    let conErr = false;
                    try {
                        let startTime = Date.now(), overTime;
                        console.log('Start:' + startTime);

                        exe('PDFtox.exe -i yxml\\tmp\\' + number + '.pdf' + ' -f '+type+' -dpi '+dpi);

                        overTime = Date.now();
                        console.log('Over:' + overTime);
                        let oldFile;
                        if(fs.existsSync('./log/times.txt')){
                            oldFile = fs.readFileSync('./log/times.txt').toString();
                            
                        }else{
                            oldFile = '';
                        }
                        fs.writeFileSync('./log/times.txt',oldFile + 'size:' + fileData.length + ' time:' + (overTime-startTime) +'\n')
                        if(fileData.length>=100000){
                            if(fs.existsSync('./log/aTime.txt')){
                            
                                oldFile = parseFloat(fs.readFileSync('./log/aTime.txt').toString());
                                fs.writeFileSync('./log/aTime.txt', ((oldFile+(overTime-startTime)/fileData.length)/2).toFixed(20));
                            }else{
                                fs.writeFileSync('./log/aTime.txt', ((overTime-startTime)/fileData.length).toFixed(20));
                            }
                        }
                        
                        zipper.sync.zip('./tmp/' + number).compress().save('./tmp/' + number + '.zip');

                        fs.unlinkSync('./tmp/' + number + '.pdf');      //转换完毕后删除pdf

                        exe('del tmp\\' + number + '\\ /q');
                        fs.rmdirSync('./tmp/' + number + '/');
                    } catch (e) {
                        console.error(e);
                        conErr = true;
                    }
                    if(!conErr){
                        res.setHeader("Content-Type", "text/plain; charset=utf-8");
                        res.write('OK ' + number);
                        res.end();
                    }else{
                        res.statusCode = 500;
                        res.statusMessage = 'error';
                        res.setHeader("Content-Type", "text/plain; charset=utf-8");
                        res.write('转换出错，请重试');
                        res.end();
                    }
                }else{
                    res.statusCode = 500;
                    res.statusMessage = 'error';
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.write('文件写出时出错，请重试');
                    res.end();
                }
                number++;
            }else{
                res.statusCode = 500;
                res.statusMessage = 'error';
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.write('上传时出错，请重试');
                res.end();
            }
        }else if(pathname == '/getfile'){
            var fileNum = obj.query.n;
            console.log('getting file:' + fileNum);
            var fileName = obj.query.name;
            if(!fileName) fileName = fileNum;
            fs.readFile('./tmp/' + fileNum + '.zip',function(err,data){
                if(err){
                    console.error('file open error:'+err);
                    res.statusCode = 404;
                    res.statusMessage = 'not found';
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.write('文件不存在');
                    res.end();
                }else{
                    res.setHeader("Content-Type", "application/zip");
                    res.setHeader('Content-Disposition','attachment; filename=' + fileName + '.zip')
                    var file = data;
                    res.write(file);
                    res.end();
                }
            });
        }else if(pathname == '/set'){
            dpi = params.dpi;
            type = params.type;
        }else if(pathname.substring(0,4) == '/img'){
            fs.readFile('.'+pathname,function(err,data){
                if(err){
                    console.error('file open error:'+err);
                    res.statusCode = 404;
                    res.statusMessage = 'not found';
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.write('文件不存在');
                    res.end();
                }else{
                    res.setHeader("Content-Type", "image/png");
                    var file = data;
                    res.write(file);
                    res.end();
                }
            });
        }else if(pathname.substring(0,3) == '/js'){
            fs.readFile('.'+pathname,function(err,data){
                if(err){
                    console.error('file open error:'+err);
                    res.statusCode = 404;
                    res.statusMessage = 'not found';
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.write('文件不存在');
                    res.end();
                }else{
                    res.setHeader("Content-Type", "text/javascript");
                    var file = data;
                    res.write(file);
                    res.end();
                }
            });
        }else if(pathname == '/atime'){
            fs.readFile('./log/aTime.txt',function(err,data){
                if(err){
                    console.error('file open error:'+err);
                    res.statusCode = 404;
                    res.statusMessage = 'not found';
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.write('请重试');
                    res.end();
                }else{
                    res.setHeader("Content-Type", "text/javascript");
                    var file = data;
                    res.write(file);
                    res.end();
                }
            });
        }
    });
}).listen(POST);

console.log('the server is running in post ' + POST);

function parseFile (body,req) {             //获取上传的文件
    var fileName = ''; // 文件名
    // 边界字符串
    var boundary = req.headers['content-type'].split('; ')[1].replace('boundary=','');
   
     var file = querystring.parse(body, '\r\n', ':')

      //获取文件名
      var fileInfo = file['Content-Disposition'].split('; ');
      for (value in fileInfo){
       if (fileInfo[value].indexOf("filename=") != -1){
        fileName = fileInfo[value].substring(10, fileInfo[value].length-1);
   
        if (fileName.indexOf('\\') != -1){
         fileName = fileName.substring(fileName.lastIndexOf('\\')+1);
        }
       }
      }
      var entireData = body.toString();

      contentType = file['Content-Type'].substring(1);
   
      //获取文件二进制数据开始位置，即contentType的结尾
      var upperBoundary = entireData.indexOf(contentType) + contentType.length;
      var shorterData = entireData.substring(upperBoundary);
   
      // 替换开始位置的空格
      var binaryDataAlmost = shorterData.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
   
      // 去除数据末尾的额外数据，即: "--"+ boundary + "--"
      var binaryData = binaryDataAlmost.substring(0, binaryDataAlmost.indexOf('--'+boundary+'--'));

      return binaryData;
}

function delFileInTmp(){
    try{
        exe('del tmp /f /q ');
        setTimeout(delFileInTmp , 1000*60);
    }catch(e){
        setTimeout(delFileInTmp , 5000);
    }
}