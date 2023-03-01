import util from '../../util';
import Component from'./Component';
import TimeStep from '../TimeStep';
import * as DateUtil  from '../DateUtil';
import moment from '../../module/moment';

import './css/timeaxis.css';

/** A horizontal time axis */
class TimeAxis extends Component {
/**
 * @param {{dom: Object, domProps: Object, emitter: Emitter, range: Range}} body
 * @param {Object} [options]        See TimeAxis.setOptions for the available
 *                                  options.
 * @constructor TimeAxis
 * @extends Component
 */
  constructor(body, options) {
    super();
    this.dom = {
      foreground: null,
      lines: [],
      majorTexts: [],
      middleTexts: [],
      minorTexts: [],
      redundant: {
        lines: [],
        majorTexts: [],
        middleTexts: [],
        minorTexts: []
      }
    };
    this.props = {
      range: {
        start: 0,
        end: 0,
        minimumStep: 0
      },
      lineTop: 0
    };

    this.defaultOptions = {
      orientation: {
        axis: 'bottom'
      },  // axis orientation: 'top' or 'bottom'
      showMinorLabels: true,
      showMiddleLabels: true,
      showMajorLabels: true,
      showWeekScale: false,
      maxMinorChars: 7,
      format: util.extend({}, TimeStep.FORMAT),
      moment,
      timeAxis: null
    };
    this.options = util.extend({}, this.defaultOptions);

    this.body = body;

    // create the HTML DOM
    this._create();

    this.setOptions(options);

    this.prevText = '';
  }

  /**
   * Set options for the TimeAxis.
   * Parameters will be merged in current options.
   * @param {Object} options  Available options:
   *                          {string} [orientation.axis]
   *                          {boolean} [showMinorLabels]
   *                          {boolean} [showMiddleLabels]
   *                          {boolean} [showMajorLabels]
   *                          {boolean} [showWeekScale]
   */
  setOptions(options) {
    if (options) {
      // copy all options that we know
      util.selectiveExtend([
        'showMinorLabels',
        'showMiddleLabels',
        'showMajorLabels',
        'showWeekScale',
        'maxMinorChars',
        'hiddenDates',
        'timeAxis',
        'moment',
        'rtl'
      ], this.options, options);

      // deep copy the format options
      util.selectiveDeepExtend(['format'], this.options, options);

      if ('orientation' in options) {
        if (typeof options.orientation === 'string') {
          this.options.orientation.axis = options.orientation;
        }
        else if (typeof options.orientation === 'object' && 'axis' in options.orientation) {
          this.options.orientation.axis = options.orientation.axis;
        }
      }

      // apply locale to moment.js
      // TODO: not so nice, this is applied globally to moment.js
      if ('locale' in options) {
        if (typeof moment.locale === 'function') {
          // moment.js 2.8.1+
          moment.locale(options.locale);
        }
        else {
          moment.lang(options.locale);
        }
      }
    }
  }

  /**
   * Create the HTML DOM for the TimeAxis
   */
  _create() {
    this.dom.foreground = document.createElement('div');
    this.dom.background = document.createElement('div');

    this.dom.foreground.className = 'vis-time-axis vis-foreground';
    this.dom.background.className = 'vis-time-axis vis-background';
  }

  /**
   * Destroy the TimeAxis
   */
  destroy() {
    // remove from DOM
    if (this.dom.foreground.parentNode) {
      this.dom.foreground.parentNode.removeChild(this.dom.foreground);
    }
    if (this.dom.background.parentNode) {
      this.dom.background.parentNode.removeChild(this.dom.background);
    }

    this.body = null;
  }

  /**
   * Repaint the component
   * @return {boolean} Returns true if the component is resized
   */
  redraw() {
    const props = this.props;
    const foreground = this.dom.foreground;
    const background = this.dom.background;

    // determine the correct parent DOM element (depending on option orientation)
    const parent = (this.options.orientation.axis == 'top') ? this.body.dom.top : this.body.dom.bottom;
    const parentChanged = (foreground.parentNode !== parent);

    // calculate character width and height
    this._calculateCharSize();

    // TODO: recalculate sizes only needed when parent is resized or options is changed
    const showMinorLabels = this.options.showMinorLabels && this.options.orientation.axis !== 'none';
    const showMiddleLabels = this.options.showMiddleLabels && this.options.orientation.axis !== 'none';
    const showMajorLabels = this.options.showMajorLabels && this.options.orientation.axis !== 'none';

    // determine the width and height of the elemens for the axis
    props.minorLabelHeight = showMinorLabels ? props.minorCharHeight : 0;
    props.middleLabelHeight = showMiddleLabels ? props.middleCharHeight : 0;
    props.majorLabelHeight = showMajorLabels ? props.majorCharHeight : 0;
    props.height = props.minorLabelHeight + props.middleCharHeight + props.majorLabelHeight;
    props.width = foreground.offsetWidth;

    props.minorLineHeight = this.body.domProps.root.height - props.majorLabelHeight - props.middleLabelHeight -
    // props.minorLineHeight = this.body.domProps.root.height - props.majorLabelHeight - props.middleLabelHeight - props.minorLabelHeight -
        (this.options.orientation.axis == 'top' ? this.body.domProps.bottom.height : this.body.domProps.top.height);
    props.minorLineWidth = 1; // TODO: really calculate width
    props.middleLineHeight = this.body.domProps.root.height - props.majorLabelHeight -
    // props.middleLineHeight = this.body.domProps.root.height - props.majorLabelHeight - props.middleLabelHeight - props.minorLabelHeight -
        (this.options.orientation.axis == 'top' ? this.body.domProps.bottom.height : this.body.domProps.top.height);
    // props.middleLineHeight = props.minorLineHeight + props.middleLineHeight;
    props.middleLineWidth = 1; // TODO: really calculate width
    props.majorLineHeight = props.minorLineHeight + props.majorLabelHeight;
    props.majorLineWidth = 1; // TODO: really calculate width

    // debug
    console.log('body.domProps.root.height:' + this.body.domProps.root.height);
    console.log('body.domProps.top.height:' + this.body.domProps.top.height);
    console.log('body.domProps.bottom.height:' + this.body.domProps.bottom.height);
    console.log('props.minorLineHeight:' + props.minorLineHeight);
    console.log('props.middleLineHeight:' + props.middleLineHeight);
    console.log('props.majorLineHeight:' + props.majorLineHeight);

    //  take foreground and background offline while updating (is almost twice as fast)
    const foregroundNextSibling = foreground.nextSibling;
    const backgroundNextSibling = background.nextSibling;
    foreground.parentNode && foreground.parentNode.removeChild(foreground);
    background.parentNode && background.parentNode.removeChild(background);

    foreground.style.height = `${this.props.height}px`;

    this._repaintLabels();

    // put DOM online again (at the same place)
    if (foregroundNextSibling) {
      parent.insertBefore(foreground, foregroundNextSibling);
    }
    else {
      parent.appendChild(foreground)
    }
    if (backgroundNextSibling) {
      this.body.dom.backgroundVertical.insertBefore(background, backgroundNextSibling);
    }
    else {
      this.body.dom.backgroundVertical.appendChild(background)
    }
    return this._isResized() || parentChanged;
  }

  /**
   * Repaint major and middle and minor text labels and vertical grid lines
   * @private
   */
  _repaintLabels() {
    const orientation = this.options.orientation.axis;

    // calculate range and step (step such that we have space for 7 characters per label)
    const start = util.convert(this.body.range.start, 'Number');
    const end = util.convert(this.body.range.end, 'Number');
    const timeLabelsize = this.body.util.toTime((this.props.minorCharWidth || 10) * this.options.maxMinorChars).valueOf();
    let minimumStep = timeLabelsize - DateUtil.getHiddenDurationBefore(this.options.moment, this.body.hiddenDates, this.body.range, timeLabelsize);
    minimumStep -= this.body.util.toTime(0).valueOf();

    const step = new TimeStep(new Date(start), new Date(end), minimumStep, this.body.hiddenDates, this.options);
    step.setMoment(this.options.moment);
    if (this.options.format) {
      step.setFormat(this.options.format);
    }
    if (this.options.timeAxis) {
      step.setScale(this.options.timeAxis);
    }
    this.step = step;

    // Move all DOM elements to a "redundant" list, where they
    // can be picked for re-use, and clear the lists with lines and texts.
    // At the end of the function _repaintLabels, left over elements will be cleaned up
    const dom = this.dom;
    dom.redundant.lines = dom.lines;
    dom.redundant.majorTexts = dom.majorTexts;
    dom.redundant.middleTexts = dom.middleTexts;
    dom.redundant.minorTexts = dom.minorTexts;
    dom.lines = [];
    dom.majorTexts = [];
    dom.middleTexts = [];
    dom.minorTexts = [];

    let current;
    let next;
    let x;
    let xNext;
    let isMajor;
    let showMinorGrid;
    let showMiddleGrid;
    let width = 0;
    let prevWidth;
    let line;
    let xFirstMajorLabel = undefined;
    let count = 0;
    const MAX = 1000;
    let className;

    step.start();
    next = step.getCurrent();
    xNext = this.body.util.toScreen(next);
    while (step.hasNext() && count < MAX) {
      count++;

      isMajor = step.isMajor();
      className = step.getClassName();

      current = next;
      x = xNext;

      step.next();
      next = step.getCurrent();
      xNext = this.body.util.toScreen(next);

      prevWidth = width;
      width = xNext - x;
      switch (step.scale) {
        case 'week':
          showMinorGrid = true;
          showMiddleGrid = true;
          break;
        default:
          showMinorGrid = (width >= prevWidth * 0.4);
          showMiddleGrid = (width >= prevWidth * 0.4); 
          break; // prevent displaying of the 31th of the month on a scale of 5 days
      }

      if (this.options.showMinorLabels && showMinorGrid) {
        var label = this._repaintMinorText(x, step.getLabelMinor(current), orientation, className);
        label.style.width = `${width}px`; // set width to prevent overflow
      }

      if (this.options.showMiddleLabels && showMiddleGrid) {
        label = this._repaintMiddleText(x, step.getLabelMiddle(current), orientation, className);
        label.style.width = `${width}px`; // set width to prevent overflow
      }

      if (isMajor && this.options.showMajorLabels) {
        if (x > 0) {
          if (xFirstMajorLabel == undefined) {
            xFirstMajorLabel = x;
          }
          label = this._repaintMajorText(x, step.getLabelMajor(current), orientation, className);
        }
        line = this._repaintMajorLine(x, width, orientation, className);
      }
      else { // middle and minor line
        if (showMiddleGrid) {
          line = this._repaintMiddleLine(x, width, orientation, className);
          continue;
        }
        if (showMinorGrid) {
          line = this._repaintMinorLine(x, width, orientation, className);
          continue;
        }
        if (line) {
          // adjust the width of the previous grid
          line.style.width = `${parseInt(line.style.width) + width}px`;
        }
      }
    }

    if (count === MAX && !warnedForOverflow) {
        console.warn(`Something is wrong with the Timeline scale. Limited drawing of grid lines to ${MAX} lines.`);
        warnedForOverflow = true;
    }

    // create a major label on the left when needed
    if (this.options.showMajorLabels) {
      const leftTime = this.body.util.toTime(0); // upper bound estimation
      const leftText = step.getLabelMajor(leftTime);
      const widthText = leftText.length * (this.props.majorCharWidth || 10) + 10;

      if (xFirstMajorLabel == undefined || widthText < xFirstMajorLabel) {
        this._repaintMajorText(0, leftText, orientation, className);
      }
    }

    // Cleanup leftover DOM elements from the redundant list
    util.forEach(this.dom.redundant, arr => {
      while (arr.length) {
        const elem = arr.pop();
        if (elem && elem.parentNode) {
          elem.parentNode.removeChild(elem);
        }
      }
    });
  }

  /**
   * Create a minor label for the axis at position x
   * @param {number} x
   * @param {string} text
   * @param {string} orientation   "top" or "bottom" (default)
   * @param {string} className
   * @return {Element} Returns the HTML element of the created label
   * @private
   */
  _repaintMinorText(x, text, orientation, className) {
    // reuse redundant label
    let label = this.dom.redundant.minorTexts.shift();

    if (!label) {
      // create new label
      const content = document.createTextNode('');
      label = document.createElement('div');
      label.appendChild(content);
      this.dom.foreground.appendChild(label);
    }
    this.dom.minorTexts.push(label);
    label.innerHTML = util.xss(text);


    let y = (orientation == 'top') ? this.props.majorLabelHeight + this.props.middleLabelHeight : 0;
    this._setXY(label, x, y);

    label.className = `vis-text vis-minor ${className}`;
    //label.title = title;  // TODO: this is a heavy operation

    return label;
  }

  /**
   * Create a middle label for the axis at position x
   * @param {number} x
   * @param {string} text
   * @param {string} orientation   "top" or "bottom" (default)
   * @param {string} className
   * @return {Element} Returns the HTML element of the created label
   * @private
   */
  _repaintMiddleText(x, text, orientation, className) {
    // reuse redundant label
    let label = this.dom.redundant.middleTexts.shift();
    
    // for debug
    // console.log('text:' + text)

    // if (label) {
    //   console.log('label.innerText:' + label.innerText)
    //   console.log('label.outerText:' + label.outerText)
    // }
    // console.log('this.dom.middleTexts.at(-1):' + this.dom.middleTexts.at(-1));

    // let prevText = '';
    // if (this.dom.middleTexts.at(-1)) {
    //   console.log('this.dom.middleTexts.at(-1).innerText:' + this.dom.middleTexts.at(-1).innerText);
    //   console.log('this.dom.middleTexts.at(-1).outerText:' + this.dom.middleTexts.at(-1).outerText);
    //   prevText = this.dom.middleTexts.at(-1).innerText;
    // }

    // if (this.dom.middleTexts.at(-1).innerText) {
    //   prevText = this.dom.middleTexts.at(-1).innerText;
    // }

    // console.log('prevText:' + prevText);

    // let isSameLabel = false;
    // same as the previous middle-label
    // if (label && this.dom.middleTexts.at(-1) && 
    //   this.dom.middleTexts.at(-1).innerText == label.innerText) {
    //   isSameLabel = true;
    // }
    if (!label) {
      // create new label
      const content = document.createTextNode('');
      label = document.createElement('div');
      label.appendChild(content);
      this.dom.foreground.appendChild(label);
    }
    this.dom.middleTexts.push(label);

    // for debug
    //console.log('this.dom.middleTexts:' + this.dom.middleTexts);
    if (text != this.prevText) {
      label.innerHTML = util.xss(text);
    } else {
      label.innerHTML = util.xss('');
    }
    this.prevText = text;
    
    let y = (orientation == 'top') ? this.props.majorLabelHeight : 0;
    this._setXY(label, x, y);

    label.className = `vis-text vis-middle ${className}`;
    //label.title = title;  // TODO: this is a heavy operation

    return label;
  }

  /**
   * Create a Major label for the axis at position x
   * @param {number} x
   * @param {string} text
   * @param {string} orientation   "top" or "bottom" (default)
   * @param {string} className
   * @return {Element} Returns the HTML element of the created label
   * @private
   */
  _repaintMajorText(x, text, orientation, className) {
    // reuse redundant label
    let label = this.dom.redundant.majorTexts.shift();

    if (!label) {
      // create label
      const content = document.createElement('div');
      label = document.createElement('div');
      label.appendChild(content);
      this.dom.foreground.appendChild(label);
    }

    label.childNodes[0].innerHTML = util.xss(text);
    label.className = `vis-text vis-major ${className}`;
    //label.title = title; // TODO: this is a heavy operation

    let y = (orientation == 'top') ? 0 : this.props.minorLabelHeight + this.props.middleLabelHeight;
    console.log('')
    this._setXY(label, x, y);

    this.dom.majorTexts.push(label);
    return label;
  }

  /**
   * sets xy
   * @param {string} label
   * @param {number} x
   * @param {number} y
   * @private
   */
  _setXY(label, x, y) {
    // If rtl is true, inverse x.
    const directionX = this.options.rtl ? (x * -1) : x;
    label.style.transform = `translate(${directionX}px, ${y}px)`;
  }

  /**
   * Create a minor line for the axis at position x
   * @param {number} left
   * @param {number} width
   * @param {string} orientation   "top" or "bottom" (default)
   * @param {string} className
   * @return {Element} Returns the created line
   * @private
   */
  _repaintMinorLine(left, width, orientation, className) {
    // reuse redundant line
    let line = this.dom.redundant.lines.shift();
    if (!line) {
      // create vertical line
      line = document.createElement('div');
      this.dom.background.appendChild(line);
    }
    this.dom.lines.push(line);

    const props = this.props;
    
    line.style.width = `${width}px`;
    line.style.height = `${props.minorLineHeight}px`;

    // let y = (orientation == 'top') ? props.majorLabelHeight + props.middleLabelHeight : this.body.domProps.top.height;
    let y = (orientation == 'top') ? props.majorLabelHeight + props.middleLabelHeight + props.minorLabelHeight: 
      this.body.domProps.top.height + props.majorLabelHeight + props.middleLabelHeight + props.minorLabelHeight;
    let x = left - props.minorLineWidth / 2;

    console.log('minor_orientation: ' + orientation);
    console.log('props.majorLabelHeight: ' + props.majorLabelHeight);
    console.log('props.middleLabelHeight: ' + props.middleLabelHeight);
    console.log('props.minorLabelHeight: ' + props.minorLabelHeight);
    console.log('minor_Y: ' + y);

    this._setXY(line, x, y);
    line.className = `vis-grid ${this.options.rtl ?  'vis-vertical-rtl' : 'vis-vertical'} vis-minor ${className}`;

    return line;
  }

  /**
   * Create a middle line for the axis at position x
   * @param {number} left
   * @param {number} width
   * @param {string} orientation   "top" or "bottom" (default)
   * @param {string} className
   * @return {Element} Returns the created line
   * @private
   */
  _repaintMiddleLine(left, width, orientation, className) {
    // reuse redundant line
    let line = this.dom.redundant.lines.shift();
    if (!line) {
      // create vertical line
      line = document.createElement('div');
      this.dom.background.appendChild(line);
    }
    this.dom.lines.push(line);

    const props = this.props;
    
    line.style.width = `${width}px`;
    line.style.height = `${props.middleLineHeight}px`;

    // let y = (orientation == 'top') ? props.majorLabelHeight : this.body.domProps.top.height;
    // let y = (orientation == 'top') ? props.majorLabelHeight : this.body.domProps.top.height + props.majorLabelHeight + props.middleLabelHeight + props.minorLabelHeight;
    let y = (orientation == 'top') ? props.majorLabelHeight + props.middleLabelHeight + props.minorLabelHeight : 
      this.body.domProps.top.height + props.majorLabelHeight + props.middleLabelHeight + props.minorLabelHeight;
    let x = left - props.middleLineWidth / 2;

    console.log('middle_orientation: ' + orientation);
    console.log('props.majorLabelHeight: ' + props.majorLabelHeight);
    console.log('body.domProps.top.height: ' + this.body.domProps.top.height);
    console.log('middle_Y: ' + y);

    this._setXY(line, x, y);
    line.className = `vis-grid ${this.options.rtl ?  'vis-vertical-rtl' : 'vis-vertical'} vis-middle ${className}`;

    return line;
  }

  /**
   * Create a Major line for the axis at position x
   * @param {number} left
   * @param {number} width
   * @param {string} orientation   "top" or "bottom" (default)
   * @param {string} className
   * @return {Element} Returns the created line
   * @private
   */
  _repaintMajorLine(left, width, orientation, className) {
    // reuse redundant line
    let line = this.dom.redundant.lines.shift();
    if (!line) {
      // create vertical line
      line = document.createElement('div');
      this.dom.background.appendChild(line);
    }
    this.dom.lines.push(line);

    const props = this.props;
    
    line.style.width = `${width}px`;
    line.style.height = `${props.majorLineHeight}px`;

    let y = (orientation == 'top') ? 0 : this.body.domProps.top.height;
    let x = left - props.majorLineWidth / 2;

    console.log('major_orientation: ' + orientation);
    console.log('major_Y: ' + y);

    this._setXY(line, x, y);
    line.className = `vis-grid ${this.options.rtl ?  'vis-vertical-rtl' : 'vis-vertical'} vis-major ${className}`;

    return line;
  }

  /**
   * Determine the size of text on the axis (major and middle and minor axis).
   * The size is calculated only once and then cached in this.props.
   * @private
   */
  _calculateCharSize() {
    // Note: We calculate char size with every redraw. Size may change, for
    // example when any of the timelines parents had display:none for example.

    // determine the char width and height on the minor axis
    if (!this.dom.measureCharMinor) {
      this.dom.measureCharMinor = document.createElement('DIV');
      this.dom.measureCharMinor.className = 'vis-text vis-minor vis-measure';
      this.dom.measureCharMinor.style.position = 'absolute';

      this.dom.measureCharMinor.appendChild(document.createTextNode('0'));
      this.dom.foreground.appendChild(this.dom.measureCharMinor);
    }
    this.props.minorCharHeight = this.dom.measureCharMinor.clientHeight;
    this.props.minorCharWidth = this.dom.measureCharMinor.clientWidth;

    // determine the char width and height on the middle axis
    if (!this.dom.measureCharMiddle) {
      this.dom.measureCharMiddle = document.createElement('DIV');
      this.dom.measureCharMiddle.className = 'vis-text vis-middle vis-measure';
      this.dom.measureCharMiddle.style.position = 'absolute';

      this.dom.measureCharMiddle.appendChild(document.createTextNode('0'));
      this.dom.foreground.appendChild(this.dom.measureCharMiddle);
    }
    this.props.middleCharHeight = this.dom.measureCharMiddle.clientHeight;
    this.props.middleCharWidth = this.dom.measureCharMiddle.clientWidth;
  
    // determine the char width and height on the major axis
    if (!this.dom.measureCharMajor) {
      this.dom.measureCharMajor = document.createElement('DIV');
      this.dom.measureCharMajor.className = 'vis-text vis-major vis-measure';
      this.dom.measureCharMajor.style.position = 'absolute';

      this.dom.measureCharMajor.appendChild(document.createTextNode('0'));
      this.dom.foreground.appendChild(this.dom.measureCharMajor);
    }
    this.props.majorCharHeight = this.dom.measureCharMajor.clientHeight;
    this.props.majorCharWidth = this.dom.measureCharMajor.clientWidth;
  }
}


var warnedForOverflow = false;

export default TimeAxis;
