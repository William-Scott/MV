/*:
 * @plugindesc This plugin allows you to type the Korean Characters called 'Hangul' <RS_Hangul>
 * @author biud436
 * @help
 * =================================================================
 * Usage
 * =================================================================
 * var h = new Hangul();
 * h.startWithComposite("ㅇㅣㅅㅡㅇㅊㅓㄹㅎㅕㅇㄴㅣㅁ", function(t) {
 *  console.log(t);
 * });
 * =================================================================
 * Change Log
 * =================================================================
 * 2018.07.18 (v1.0.0) - First Release.
 */
/*:ko
 * @plugindesc 한글 조합 입력 기능을 제공합니다. <RS_Hangul>
 * @author biud436
 * @help
 * =================================================================
 * Usage
 * =================================================================
 * var h = new Hangul();
 * h.startWithComposite("ㅇㅣㅅㅡㅇㅊㅓㄹㅎㅕㅇㄴㅣㅁ", function(t) {
 *  console.log(t);
 * });
 * =================================================================
 * Change Log
 * =================================================================
 * 2018.07.18 (v1.0.0) - First Release.
 */

var Imported = Imported || {};
Imported.RS_Hangul = true;

var RS = RS || {};
RS.Hangul = RS.Hangul || {};
RS.Keyboard = RS.Keyboard || {};

function HangulIME() {
    this.initialize.apply(this, arguments);
};

(function() {
    
    // 한글 음절표 19 * 21 * (27 + 1) = 11172;

    // 초성 19자
    var chosung = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
    // 중성 21자
    var joongsung = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
    // 종성 28자 (공백 포함)
    var jongsung = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

    // 자음(닿소리)
    var consonant1 = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
    // 쌍자음(겹닿소리)
    var consonant2 = 'ㄲㄸㅃㅆㅉ';
    // 흩모음 (홀소리)
    var vowel1 = 'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ';
    // 겹모음 (겹홀소리)
    var vowel2 = 'ㅐㅒㅔㅖㅘㅙㅚㅗㅝㅞㅟㅢ';
    // 겹받침
    var consonant3 = 'ㄲㅆㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ';
    
    HangulIME.prototype.constructor = HangulIME;
    
    HangulIME.prototype.initialize = function() {
        this.initMembers();
    };

    HangulIME.STEP11 = 1;   HangulIME.STEP12 = 2;
    HangulIME.STEP21 = 3;   HangulIME.STEP22 = 4; 
    HangulIME.STEP31 = 5;   HangulIME.STEP32 = 6;
    HangulIME.STEP42 = 7;   HangulIME.STEP43 = 8;

    HangulIME.prototype.initMembers = function() {
        this._composing = false; // 조합중
        this._messTexts = null; // 조합전 텍스트
        this._hanTexts = {
        'first': -1,
        'middle': -1,
        'final': -1,
        }; // 조합후 텍스트
        this._retTexts = ""; // 조합후 텍스트
        this._index = 0;
        this._lastIndex = 0;
        this._currentStep = HangulIME.STEP11; 
    };

    // 1.0. 키가 입력되면 커서가 조합 중으로 변경된다 (얇은 커서가 왼쪽 굵은 커서가 오른쪽)
    HangulIME.prototype.startWithComposite = function(texts, func) {
        this.initMembers();
        this._messTexts = this.decompress(texts);
        this._composing = true; // 조합 중으로 변경한다.
        this._index = 0; // 인덱스 0부터 시작
        var depth = 0;
        for(;;) {
            if(1000 < depth) { // 문장이 너무 길어지는 것 방지
                func(this._retTexts);
                break;
            }
            if(this._index > this._messTexts.length) { // 조합 완료되었으면 끝낸다.
                func(this._retTexts);
                break;
            }            
            if(this._currentStep === HangulIME.STEP11) { // 초성1 처리(겹받침 및 겹모음 처리)
                this.startStep11();
            } else if(this._currentStep === HangulIME.STEP12) { // 초성 2 처리
                this.startStep12();
            } else if(this._currentStep === HangulIME.STEP21) { // 중성 1 처리 (겹홀소리 처리)
                this.startStep21();
            } else if (this._currentStep === HangulIME.STEP22) { // 중성 2 처리
                this.startStep22();
            } else if (this._currentStep === HangulIME.STEP31) { // 종성 1 처리 (겹받침 처리)
                this.startStep31();
            } else if (this._currentStep === HangulIME.STEP32) { // 종성 2 처리
                this.startStep32();
            } else if (this._currentStep === HangulIME.STEP42) { // 완성형 글자를 만든다.
                this.startStep42();
            } else if (this._currentStep === HangulIME.STEP43) { // 특수 문자, 영어 처리
                this.startStep43();
            }

            depth++;

        }
    };

    // 1.1. 초성이 종성으로 대체되고, 겹받침이 되었나? (ㄱㄴㄹㅂ)
    // = true이면 겹받침 처리 후 4.2로, false면 1.2로
    HangulIME.prototype.startStep11 = function() {
        var currentChar = this._messTexts[this._index];
        var nextChar = this._messTexts[this._index + 1];
        var lastChar = this._messTexts[this._index + 1];
        var ret = false;
    
        // 다음 글자가 없다면 인덱스를 늘린다.
        if(!currentChar) {
            this._index++;
            return;
        }

        // 겹받침 또는 겹모음인가?
        if(ret = this.processDoubleFinalConsonant(currentChar, nextChar, lastChar)) {
            this._currentStep = HangulIME.STEP42;
        } else { // 그외 글자라면 
            this._currentStep = HangulIME.STEP12;
        }
        
    };

    HangulIME.prototype.isHangul = function(text) {
        // U+1100 ~ U+11FF 한글 자모 256
        // U+AC00 ~ U+D7AF 한글 글자 마디 11,184
        // https://d2.naver.com/helloworld/76650
        var pattern = /[\u1100-\u11FF\uAC00-\uD7AF]/;
        return pattern.test(text);
    };

    /**
     * 한글 자모 분리
     * @param {String}} text 
     * @param {Boolean} isNumber 
     */
    HangulIME.prototype.decompress = function(texts, isNumber) {
        var ret = [];

        for(var i = 0; i < texts.length; i++) {
            var c = texts[i];
            if(!this.isHangul(c)) {
                ret.push(c);
                continue;
            };

            var code = c.charCodeAt();
            var offset = code - 0xAC00;
    
            var first = Math.floor(offset / 588);
            var middle = Math.floor((offset % 588) / 28);
            var final = Math.floor(offset % 28);
    
            ret.push(chosung[first]);
            ret.push(joongsung[middle]);
            ret.push(jongsung[final]);
        }
 
        return ret;

    };

    // 1.2. 쌍자음 또는 1.1이 아닌 정상 범주라면 정상 추가한다.
    // = true이면 글자 처리 후 2-1로 이동, false면 4.3으로 이동.
    HangulIME.prototype.startStep12 = function() {

        var c = this._messTexts[this._index];
        var idx = this.isFirst(c);

        // 초성이 맞다면 중성 단계로 진입한다.
        if(idx >= 0) {
            // 초성을 설정한다.
            this.setFirst(idx);
            // 다음 단계로
            this._index++;
            this._currentStep = HangulIME.STEP21;
            return true;
        } else { // 초성이 아니라면, 다른 글자이므로 그냥 추가한다.
            
            if(this.isMiddle(c) >= 0) { // 중성이면 바로 중성 단계로
                this._currentStep = HangulIME.STEP21;
                return true;
            } else { // 중성이 아니면 영어나 특수 문자, 공백이므로 그냥 추가한다.
                this._currentStep = HangulIME.STEP43;
                return false;
            }
        }

    };    

    // 2.1. 중성이 겹모음이 될 가능성이 있나? ㅗㅜㅡ인가?
    // = true이면 겹모음 처리 후 3.1로, false면 2.2로
    HangulIME.prototype.startStep21 = function() {
        var currentChar = this._messTexts[this._index];
        var nextChar = this._messTexts[this._index + 1];
        var lastChar = this._messTexts[this._index + 2];
        var ret = false;
        
        // 겹홀소리 중 조합 가능하다면 처리 후 종성 단계로
        if(ret = this.processDoubleVowel(currentChar, nextChar, lastChar)) {          
            this._currentStep = HangulIME.STEP31;
            return true;
        } else { // 홀소리, 조합되지 않는 겹홀소리라면 중성 처리로
            this._currentStep = HangulIME.STEP22;
            return false;
        }
    };    

    // 2.2. 중성이 2.1에 위배되지 않고 정상 범주인가?
    // = true이면 글자 처리 후 3.1로, false면 4.3으로 이동
    HangulIME.prototype.startStep22 = function() {
        var c = this._messTexts[this._index];
        var cc = this._messTexts[this._index + 1];
        var ccc = this._messTexts[this._index + 2];
        var idx = this.isMiddle(c);

        // 중성이 맞다면 종성 단계로 진입한다.
        if(idx >= 0) {

            // 중성을 설정한다.
            this.setMiddle(idx);
            // 다음 단계로
            this._currentStep = HangulIME.STEP31;
            this._index++;
            return true;            

        } else { // 중성이 아니라면, 다른 글자이므로 그냥 추가한다.
            this._index--; // 중성이 없기 때문에 인덱스를 줄여 현재 인덱스로 설정한다.
            this._currentStep = HangulIME.STEP43;
            return false;
        }
    };        

    // 3.1. 종성이 겹받침이 될 수 있나? (ㄱㄴㄹㅂ)
    // = true이면 겹받침 처리 후 4.2로, false면 3.2로
    HangulIME.prototype.startStep31 = function() {
        var currentChar = this._messTexts[this._index];
        var nextChar = this._messTexts[this._index + 1];
        var lastChar = this._messTexts[this._index + 2];
        var ret = false;

        // 공백으로 초기화한다.
        this.setFinal(0);
  
        // 종성이 겹받침이 될 수 있나? 가능하다면 겹받침 처리
        if(ret = this.processDoubleFinalConsonant(currentChar, nextChar, lastChar)) {     
            this._currentStep = HangulIME.STEP42;
        } else { // 조합이 불가능하다면 일반 종성 처리로
        
            if(this.isFirst(currentChar) >= 0 && this.isMiddle(nextChar) >= 0) {
                this._currentStep = HangulIME.STEP42;
                return false;
            }             

            // 종성이 없으면 조합을 마친다.
            if(currentChar === undefined) {
                this._currentStep = HangulIME.STEP42;
                return false;
            }
                                
            this._currentStep = HangulIME.STEP32;
        }
    };      

    // 3.2. 종성이 공백 또는 정상 범주인가?
    // = true이면 4.2로, false는 4.3으로 이동
    HangulIME.prototype.startStep32 = function() {
        var c = this._messTexts[this._index];
        var cc = this._messTexts[this._index + 1];
        var idx = this.isFinal(c);

        // 종성이 맞다면 종성 단계로 진입한다.
        if(idx >= 0) {        

            this.setFinal(idx);
            // 다음 단계로
            this._currentStep = HangulIME.STEP42;
            this._index++;
            return true;

        } else {          
            // 중성이 아니라면, 다른 글자이므로 그냥 추가한다.
            // 종성이 없으므로 인덱스를 줄여 현재 인덱스로 맞춘다.
            // 현재까지 조합된 것을 완료한다.
            // this.makeWansung(c.first, c.middle, c.final);        
            this._currentStep = HangulIME.STEP42;
            return false;
        }
    };                 
 
    // 4.2. 마지막 글자를 추가하고 조합 완료 (커서가 굵은 것만 남는다)
    HangulIME.prototype.startStep42 = function() {
        var c = this._hanTexts;
        this._retTexts += this.makeWansung(c.first, c.middle, c.final);
        this._lastIndex = this._index;
        this._currentStep = HangulIME.STEP11;
        
        return true;
    };            

    // 4.3. 조합 완료 후 글자 추가 (커서가 굵은 것만 남는다), 영어나 특수 문자, 숫자 등 한글 범주(인덱스)가 아니라면
    HangulIME.prototype.startStep43 = function() {
        this._retTexts += this._messTexts[this._index];
        this._currentStep = HangulIME.STEP11;
        this._index++;
        return true;
    };            

    /**
     * 초성 인덱스
     * @param {Number} index 
     */
    HangulIME.prototype.setFirst = function(index) {
        this._hanTexts.first = index;
    };
    
    /**
     * 중성 인덱스
     * @param {Number} index 
     */
    HangulIME.prototype.setMiddle = function(index) {
        this._hanTexts.middle = index;
    };    

    /**
     * 종성 인덱스
     * @param {Number} index 
     */
    HangulIME.prototype.setFinal = function(index) {
        this._hanTexts.final = index;
    };        

    HangulIME.prototype.isFirst = function(text) {
        var ret = chosung.indexOf(text);
        return (ret >= 0) ? ret : -1;
    };

    HangulIME.prototype.isMiddle = function(text) {
        var ret = joongsung.indexOf(text);
        return (ret >= 0) ? ret : -1;
    };    

    HangulIME.prototype.isFinal = function(text) {
        var ret = jongsung.indexOf(text);
        return (ret >= 0) ? ret : -1;
    };        

    // 겹받침 처리 후 리턴 위치로
    HangulIME.prototype.processDoubleFinalConsonant = function(currentChar, nextChar, lastChar) {
        var ret = "";
    
        // 중성인가? 겹모음인가? 
        if( this.isMiddle(currentChar) >= 0 ) {
            this.processDoubleVowel(currentChar, nextChar, lastChar);
            return false;
        }

        // 다음 글자의 다음 글자가 중성이면 빠져나가야 한다.
        if (this.isFirst(nextChar) >= 0 && this.isMiddle(lastChar) >= 0) {
            return false; 
        }

        if( currentChar === "ㄱ" && nextChar === "ㅅ") {
            ret = 'ㄳ';
        } else if( currentChar === "ㄴ" && nextChar === "ㅈ") {
            ret = 'ㄵ';
        } else if( currentChar === "ㄴ" && nextChar === "ㅎ") {
            ret = 'ㄶ';
        } else if( currentChar === "ㄹ" && nextChar === "ㄱ") {
            ret = 'ㄺ';
        } else if( currentChar === "ㄹ" && nextChar === "ㅁ") {
            ret = 'ㄻ';
        } else if( currentChar === "ㄹ" && nextChar === "ㅂ") {
            ret = 'ㄼ';
        } else if( currentChar === "ㄹ" && nextChar === "ㅅ") {
            ret = 'ㄽ';
        } else if( currentChar === "ㄹ" && nextChar === "ㅌ") {
            ret = 'ㄾ';
        } else if( currentChar === "ㄹ" && nextChar === "ㅍ") {
            ret = 'ㄿ';
        } else if( currentChar === "ㄹ" && nextChar === "ㅎ") {
            ret = 'ㅀ';
        } else if( currentChar === "ㅂ" && nextChar === "ㅅ") {
            ret = 'ㅄ';
        } 
        
        if(ret !== "") {

            // 겹받침이 분리된 부분을 제거한다.
            this._index++;
            this._index++;

            // 종성을 설정한다.
            var idx = this.isFinal(ret);
            if(idx >= 0) { // 종성인가?
                if(this._currentStep < HangulIME.STEP21) {
                    this.setFirst(-1); 
                    this.setMiddle(-1); 
                }
                this.setFinal(idx); 
                return true;
            } else {
                return false;
            }
        } else { // 아니면 초성 설정으로
            return false;
        }                                                   
    };

    // 겹모음 처리 후 리턴 위치로
    HangulIME.prototype.processDoubleVowel = function(currentChar, nextChar, lastChar) { 

        // 겹모음으로 조합이 가능한 ㅗㅜㅡ인가?
        var middles = "ㅗㅜㅡ";
        if(middles.indexOf(currentChar) < 0) {
            return false;
        }

        var ret = "";

        if( currentChar === "ㅗ") {
            if(nextChar === "ㅏ") ret = "ㅘ";
            if(nextChar === "ㅐ") ret = "ㅙ";
            if(nextChar === "ㅣ") ret = "ㅚ";
        } else if( currentChar === "ㅜ") {
            if(nextChar === "ㅓ") ret = "ㅝ";
            if(nextChar === "ㅔ") ret = "ㅞ";
            if(nextChar === "ㅣ") ret = "ㅟ"; 
        } else if( currentChar === "ㅡ" ) {
            if(nextChar === "ㅣ") ret = "ㅢ";
        } 

        if(ret !== "") {

            this._index++;
            this._index++;    

            var idx = this.isMiddle(ret);

            // 중성인가?
            if(idx >= 0) {

                this.setMiddle(idx); // 중성 설정

                // 초성이 없는 상태라면
                if(this._currentStep < HangulIME.STEP21) {
                    this._currentStep = HangulIME.STEP11;
                }

                return true;
            }
        }     
    };

    HangulIME.prototype.makeWansung = function(first, middle, final) {

        // 초성 글자만 있다면
        if((first >= 0) && (middle < 0) && final < 0) {
            return chosung[first];
        }

        // 종성 글자만 있다면
        if((first < 0) && (middle < 0) && final > 0) {
            return jongsung[final];
        }

        if(final < 0 || !final) final = 0;

        // 초성, 중성, 종성 OK
        var startCode = 44032;
        var code = 44032 + (first * 588) + (middle * 28) + final;
        var ret = String.fromCharCode(code);

        return ret;
        
    };

    RS.Hangul = new HangulIME();

})();

(function() {

    function VirtualKeyboardMV() {
        this.initialize.apply(this, arguments);
    };    

    VirtualKeyboardMV.prototype.constructor = VirtualKeyboardMV;

    VirtualKeyboardMV.BACK_SPACE = 8;
    VirtualKeyboardMV.ENTER = 13;
    VirtualKeyboardMV.IS_NOT_CHAR = 32; // SPACE_BAR와 동일
    VirtualKeyboardMV.KEYS_ARRAY = 255;   
    VirtualKeyboardMV.HAN_EN = 21; // 한영키

    VirtualKeyboardMV.KEYS = {
        "ko": {
            8: [""],
            21: [""],
            32: [" "],
            49: ["1", "!"],
            50: ["2", "@"],
            51: ["3", "#"],
            52: ["4", "$"],
            53: ["5", "%"],
            54: ["6", "^"],
            55: ["7", "&"],
            56: ["8", "*"],
            57: ["9", "("],
            48: ["0", ")"],
            65: ["ㅁ"],
            66: ["ㅠ"],
            67: ["ㅊ"],
            68: ["ㅇ"],
            69: ["ㄷ", "ㄸ"],
            70: ["ㄹ"],
            71: ["ㅎ"],
            72: ["ㅗ"],
            73: ["ㅑ"],
            74: ["ㅓ"],
            75: ["ㅏ"],
            76: ["ㅣ"],
            77: ["ㅡ"],
            78: ["ㅜ"],
            79: ["ㅐ", "ㅒ"],
            80: ["ㅔ", "ㅖ"],
            81: ["ㅂ", "ㅃ"],
            82: ["ㄱ", "ㄲ"],
            83: ["ㄴ"],
            84: ["ㅅ", "ㅆ"],
            85: ["ㅕ"],
            86: ["ㅍ"],
            87: ["ㅈ", "ㅉ"],
            88: ["ㅌ"],
            89: ["ㅛ"],
            90: ["ㅋ"],
            188: [",", "<"],
            190: [".", ">"],
            191: ["/", "?"]
        },
        "en": {
            8: [""],
            21: [""],
            32: [" "],
            49: ["1", "!"],
            50: ["2", "@"],
            51: ["3", "#"],
            52: ["4", "$"],
            53: ["5", "%"],
            54: ["6", "^"],
            55: ["7", "&"],
            56: ["8", "*"],
            57: ["9", "("],
            48: ["0", ")"],
            65: ["a", "A"],
            66: ["b", "B"],
            67: ["c", "C"],
            68: ["d", "D"],
            69: ["e", "E"],
            70: ["f", "F"],
            71: ["g", "G"],
            72: ["h", "H"],
            73: ["i", "I"],
            74: ["j", "J"],
            75: ["k", "K"],
            76: ["l", "L"],
            77: ["m", "M"],
            78: ["n", "M"],
            79: ["o", "O"],
            80: ["p", "P"],
            81: ["q", "Q"],
            82: ["r", "R"],
            83: ["s", "S"],
            84: ["t", "T"],
            85: ["u", "U"],
            86: ["v", "V"],
            87: ["w", "W"],
            88: ["x", "X"],
            89: ["y", "Y"],
            90: ["z", "Z"],            
            188: [",", "<"],
            190: [".", ">"],
            191: ["/", "?"]
        }
    };    
    
    VirtualKeyboardMV.prototype.initialize = function() {
        this.initMembers();
    };

    VirtualKeyboardMV.prototype.initMembers = function() {
        this._texts = "";
        this._lastTexts = "";
        this._cursorIndex = 0;
        this._isValid = false;
        this._keyboardMode = "ko";
        this._composeMode = false;
        this._stackLevel = 0;
        this._lastKeyCode = 0;
    };    

    VirtualKeyboardMV.prototype.processSpacebar = function() {
        var han = RS.Hangul.decompress(this._texts);
        var text = han.pop();
        var pos = this._cursorIndex;
        this._texts = this._texts.split("");
        // 마지막 글자가 한글 범위이고 종성이 비어있으면 스페이스바 두 번
        if(RS.Hangul.isFinal(text) <= 0) { 
            this._texts.splice(pos, 0, " ");
            this._texts.splice(pos, 0, " ");
            this._cursorIndex++;
        } else { // 그게 아니라면 한 번만 띄어쓰기를 한다.
            this._texts.splice(pos, 0, " ");
        }
        this._texts = this._texts.join("");
        this._cursorIndex++;
    };

    VirtualKeyboardMV.prototype.processBackspace = function() {
        var texts = RS.Hangul.decompress(this._texts);
        var pos = this.currentCursorPosition() - 1;
        if(pos < 0) pos = 0;

        this._texts = texts;
        this._texts.splice(pos, 1);
        this._texts = this._texts.join("");
        this._cursorIndex = pos;
    };

    VirtualKeyboardMV.prototype.processHangul = function(text) {
        this._lastTexts = text; // 텍스트 복제 후 임시 저장
    };    

    VirtualKeyboardMV.prototype.getTexts = function() {
        return this._lastTexts.slice(0);
    };        

    VirtualKeyboardMV.prototype.lastKeyCode = function() {
        return this._lastKeyCode;
    };

    VirtualKeyboardMV.prototype.addText = function(text) {
        // var texts = RS.Hangul.decompress(this._texts);  // 자모 수준으로 분해
        var texts = this._texts.split("");
        var pos = this.currentCursorPosition();
        this._texts = texts;
        this._texts.splice(pos, 0, text);
        this._texts = this._texts.join("");
        this._cursorIndex++;
        this._stackLevel++;
    };

    VirtualKeyboardMV.prototype.valid = function() {
        this._isValid = true; // 포커스를 가진다면
    };    

    VirtualKeyboardMV.prototype.inValid = function() {
        this._isValid = false; // 포커스를 가지지 않는다면
    };        

    VirtualKeyboardMV.prototype.isValid = function() {
        return this._isValid;
    };

    VirtualKeyboardMV.prototype.moveLeft = function() {
        var min = 0;
        var max = this._texts.length;

        this._cursorIndex--;
        
        if(this._cursorIndex < 0) {
            this._cursorIndex = 0;
        }

        if(this._cursorIndex > max) {
            this._cursorIndex = max;
        }

        return this._cursorIndex;
    };

    VirtualKeyboardMV.prototype.moveRight = function() {
        var min = 0;
        var max = this._texts.length; // 한 글자 기준.

        this._cursorIndex++;
        
        if(this._cursorIndex < 0) {
            this._cursorIndex = 0;
        }

        if(this._cursorIndex > max) {
            this._cursorIndex = max;
        }

        return this._cursorIndex;
    };    

    VirtualKeyboardMV.prototype.currentCursorPosition = function(offset) {

        var min = 0;
        var max = this._texts.length; // 한 글자 기준.

        offset = offset || 0;
        var pos = this._cursorIndex + offset;

        if(pos < 0) {
            pos = 0;
        }

        if(pos > max) {
            pos = max;
        }

        return pos;
    };

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    VirtualKeyboardMV.prototype.onKeyDown = function(event) {
        var keyCode = event.which;
        var lang = this._keyboardMode;
        var keys = VirtualKeyboardMV.KEYS[lang];
        var hans = Object.keys(keys);

        this._lastKeyCode = keyCode;
    
        var c = keys[keyCode]; // 입력된 텍스트       
        var text = "";

        if(hans.indexOf(String(keyCode)) >= 0) {
            text = (event.shiftKey && c.length > 1) ? c[1] : c[0];            
        }

        // 한영 키 처리
        if(VirtualKeyboardMV.HAN_EN === keyCode) {
            this._keyboardMode = this._keyboardMode === "ko"? "en":"ko";
            return;
        }

        // 왼쪽 방향키
        if(37 === keyCode) {
            this.moveLeft();
            return;
        }        

        // 오른쪽 방향키
        if(39 === keyCode) {
            this.moveRight();
            return;
        }               

        if(!this.isValid()) return; // 키보드 포커스가 없다면 입력 실패
        
        // 띄어쓰기 처리
        if(VirtualKeyboardMV.IS_NOT_CHAR === keyCode) { 
            this.processSpacebar();
            return;
        }

        // 백스페이스 처리
        if(VirtualKeyboardMV.BACK_SPACE === keyCode) { 
            this.processBackspace();
            RS.Hangul.startWithComposite(this._texts, this.processHangul.bind(this));
            console.log(keyCode, " - ", this._lastTexts);
            return;
        }        

        if(text === "") {
            return;
        }

        // 입력 처리
        this.addText(text);
        
        // 조합 처리
        RS.Hangul.startWithComposite(this._texts, this.processHangul.bind(this));
        console.log(keyCode, " - ", this._lastTexts);
    
    };

    RS.Keyboard = new VirtualKeyboardMV();
    RS.Keyboard.valid();

    document.addEventListener('keydown', RS.Keyboard.onKeyDown.bind(RS.Keyboard), false);

})();