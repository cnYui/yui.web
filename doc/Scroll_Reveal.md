相关参数和依赖：
Props
Property	Type	Default	Description
children
ReactNode

—
The text or elements to be animated. If a string is provided, it will be split into words.

scrollContainerRef
React.RefObject

window
Optional ref for the scroll container. If provided, GSAP will use this container for scroll triggers; otherwise, it defaults to the window.

enableBlur
boolean

true
Enables the blur animation effect on the words.

baseOpacity
number

0.1
The initial opacity value for the words before the animation.

baseRotation
number

3
The starting rotation (in degrees) for the container before it animates to 0.

blurStrength
number

4
The strength of the blur effect (in pixels) applied at the start of the animation.

containerClassName
string

""
Additional CSS class(es) to apply to the container element.

textClassName
string

""
Additional CSS class(es) to apply to the text element.

rotationEnd
string

"bottom bottom"
The scroll trigger end point for the container rotation animation.

wordAnimationEnd
string

"bottom bottom"
The scroll trigger end point for the word opacity and blur animations. The animation will complete when the bottom of the text reaches the bottom of the container.

Dependencies
gsap

installation
npm install gsap
usage
import ScrollReveal from './ScrollReveal';

<ScrollReveal
  baseOpacity={0}
  enableBlur={true}
  baseRotation={5}
  blurStrength={10}
>
  When does a man die? When he is hit by a bullet? No! When he suffers a disease?
  No! When he ate a soup made out of a poisonous mushroom?
  No! A man dies when he is forgotten!
</ScrollReveal>
code

CSS
.scroll-reveal {
  margin: 20px 0;
}

.scroll-reveal-text {
  font-size: clamp(1.6rem, 4vw, 3rem);
  line-height: 1.5;
  font-weight: 600;
}

.word {
  display: inline-block;
}
