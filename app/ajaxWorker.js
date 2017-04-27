const axios = require('axios')

const ajax = axios.create({
  baseURL: 'http://z.npff.co:8000/api/',
  //baseURL: 'https://neuropuff.com/api/',
  timeout: 15000,
  xsrfCookieName: 'csrftoken'
});

onmessage = function(e) {
  let method = e.data.method;
  let url = e.data.url;
  let obj = e.data.obj ? e.data.obj : {};
  let params = e.data.params ? e.data.params : [];
  ajax[method](url, obj).then((res)=>{
    postMessage({
      data: res.data,
      func: e.data.func,
      params: params
    });
  }).catch((err)=>{
    console.log(err)
    postMessage({
      func: e.data.func,
      params: e.data.params,
      err: 'err'});
  });
}