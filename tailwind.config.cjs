module.exports = {
  content: ['./index.html','./app.js','./operations.js'],
  theme: {extend: {
    fontFamily:{sans:['Plus Jakarta Sans','Inter','sans-serif'],display:['Plus Jakarta Sans','sans-serif']},
    colors:{brand:{50:'#f0f7ff',100:'#e0effe',400:'#38bdf8',500:'#1b7bc9',600:'#1565a0',700:'#0f4c81',900:'#092540',dark:'#0b1c30'}},
    boxShadow:{soft:'0 10px 25px -3px rgba(27,123,201,.12)',nav:'0 -6px 24px rgba(15,76,129,.14)',card:'0 4px 16px rgba(0,0,0,.05)'}
  }},
  plugins:[require('@tailwindcss/forms'),require('@tailwindcss/container-queries')]
};
