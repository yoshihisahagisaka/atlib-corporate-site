
//====CC 左に動くアニメーションここから===
function slideAnimecc(){
    $('.leftAnime-cc').each(function(){ 
      var elemPos = $(this).offset().top+100;
      var scroll = $(window).scrollTop();
      var windowHeight = $(window).height();
      if (scroll >= elemPos - windowHeight){
        //左から右へ表示するクラスを付与
        //テキスト要素を挟む親要素（左側）とテキスト要素を元位置でアニメーションをおこなう
        $(this).addClass("slideAnimeLeftRight-cc"); //要素を左枠外にへ移動しCSSアニメーションで左から元の位置に移動
        $(this).children(".leftAnimeInner-cc").addClass("slideAnimeRightLeft-cc");  //子要素は親要素のアニメーションに影響されないように逆の指定をし元の位置をキープするアニメーションをおこなう
      //}else{
        //左から右へ表示するクラスを取り除く
        //$(this).removeClass("slideAnimeLeftRight-cc");
        //$(this).children(".leftAnimeInner-cc").removeClass("slideAnimeRightLeft-cc");
        
      }
    });
  }
  // 画面をスクロールをしたら動かしたい場合の記述
  $(window).scroll(function (){
    slideAnimecc();/* アニメーション用の関数を呼ぶ*/
  });// ここまで画面をスクロールをしたら動かしたい場合の記述

  // 画面が読み込まれたらすぐに動かしたい場合の記述
  $(window).on('load', function(){
    slideAnimecc();/* アニメーション用の関数を呼ぶ*/
  });// ここまで画面が読み込まれたらすぐに動かしたい場合の記述


//====CCのLINE 左に動くアニメーションここから===
function slideAnimeline(){
    $('.leftAnime-line').each(function(){ 
      var elemPos = $(this).offset().top+100;
      var scroll = $(window).scrollTop();
      var windowHeight = $(window).height();
      if (scroll >= elemPos - windowHeight){
        //左から右へ表示するクラスを付与
        //テキスト要素を挟む親要素（左側）とテキスト要素を元位置でアニメーションをおこなう
        $(this).addClass("slideAnimeLeftRight-line"); //要素を左枠外にへ移動しCSSアニメーションで左から元の位置に移動
        $(this).children(".leftAnimeInner-line").addClass("slideAnimeRightLeft-line");  //子要素は親要素のアニメーションに影響されないように逆の指定をし元の位置をキープするアニメーションをおこなう
      //}else{
        //左から右へ表示するクラスを取り除く
        //$(this).removeClass("slideAnimeLeftRight-line");
        //$(this).children(".leftAnimeInner-line").removeClass("slideAnimeRightLeft-line");
        
      }
    });
  }
  // 画面をスクロールをしたら動かしたい場合の記述
  $(window).scroll(function (){
    slideAnimeline();/* アニメーション用の関数を呼ぶ*/
  });// ここまで画面をスクロールをしたら動かしたい場合の記述

  // 画面が読み込まれたらすぐに動かしたい場合の記述
  $(window).on('load', function(){
    slideAnimeline();/* アニメーション用の関数を呼ぶ*/
  });// ここまで画面が読み込まれたらすぐに動かしたい場合の記述
