from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Flowable, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from pathlib import Path
import math
root=Path(__file__).resolve().parents[2]
fonts=Path('/usr/share/fonts/liberation-serif-fonts')
for name,file in [('Paper','LiberationSerif-Regular.ttf'),('PaperBold','LiberationSerif-Bold.ttf'),('PaperItalic','LiberationSerif-Italic.ttf')]:pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
pdfmetrics.registerFontFamily('Paper',normal='Paper',bold='PaperBold',italic='PaperItalic',boldItalic='PaperBold')
W,H=612,792; margin=46.8; gap=18; cw=(W-2*margin-gap)/2; top=738; bottom=54
body=ParagraphStyle('body',fontName='Paper',fontSize=10,leading=11.4,alignment=TA_JUSTIFY,spaceAfter=4)
head=ParagraphStyle('head',parent=body,fontName='PaperItalic',spaceBefore=5,spaceAfter=3,keepWithNext=True)
caption=ParagraphStyle('caption',parent=body,fontSize=8,leading=9,alignment=TA_JUSTIFY,spaceAfter=6)
equation=ParagraphStyle('eq',parent=body,fontSize=9,leading=12,alignment=TA_CENTER,spaceBefore=2,spaceAfter=4)
section=ParagraphStyle('section',parent=body,fontName='Paper',alignment=TA_CENTER,fontSize=10,spaceAfter=6)
refstyle=ParagraphStyle('refs',parent=body,fontSize=8,leading=9,spaceAfter=2)
class Diagram(Flowable):
 def __init__(self,kind):Flowable.__init__(self);self.kind=kind;self.width=cw;self.height=184 if kind=='flow' else 89
 def draw(self):
  c=self.canv;c.setStrokeColor(colors.black);c.setFillColor(colors.black);c.setLineWidth(.6)
  def label(x,y,text,size=8):c.setFont('Paper',size);c.drawCentredString(x,y,text)
  def box(x,y,w,h,text):c.rect(x,y,w,h);lines=text.split('\n');[label(x+w/2,y+h/2+((len(lines)-1)/2-i)*9-3,line) for i,line in enumerate(lines)]
  def arrow(x1,y1,x2,y2):
   c.line(x1,y1,x2,y2);a=math.atan2(y2-y1,x2-x1);l=4
   c.line(x2,y2,x2-l*math.cos(a-.45),y2-l*math.sin(a-.45));c.line(x2,y2,x2-l*math.cos(a+.45),y2-l*math.sin(a+.45))
  if self.kind=='flow':
   x=31;w=184;h=21
   box(x,161,w,h,'Select routine → comfortable calibration')
   box(x,130,w,h,'Instructions + 5-s preparation')
   box(x,99,w,h,'Browser landmarks + visibility checks')
   box(x,68,w,h,'Pose rules + optional reference distance')
   box(x,37,w,h,'3-s stable match → alignment + feedback')
   box(x,6,w,h,'10–20 s in range → rest 15 s → next pose')
   for y in [161,130,99,68,37]:arrow(x+w/2,y,x+w/2,y-10)
   c.line(x+w,78,x+w+15,78);c.line(x+w+15,78,x+w+15,109);arrow(x+w+15,109,x+w,109)
   c.saveState();c.translate(x+w+23,93);c.rotate(90);label(0,0,'Retry',7);c.restoreState()
   c.line(x,16,13,16);c.line(13,16,13,140);arrow(13,140,x,140)
   c.saveState();c.translate(7,77);c.rotate(90);label(0,0,'Next pose / side',7);c.restoreState()
  else:
   A=(24,72);B=(68,36);C=(121,59)
   c.setLineWidth(1.3);c.line(*A,*B);c.line(*B,*C)
   for pt,n in [(A,'A'),(B,'B'),(C,'C')]:c.circle(*pt,2,fill=1);label(pt[0],pt[1]+7,n,8)
   c.setLineWidth(.5);c.arc(51,19,85,53,startAng=23,extent=117);label(70,57,'θ',10)
   label(76,5,'(a) Joint angle at B',8)
   x1=145;x2=cw-9;y=39;c.line(x1,y,x2,y)
   c.setLineWidth(3);c.line(164,y,223,y);c.setLineWidth(.5)
   for x,n in [(164,'T'),(223,'I')]:c.line(x,y-5,x,y+5);label(x,y-16,n,9)
   c.setDash(2,2);c.line(155,y,164,y);c.line(223,y,232,y);c.setDash()
   label(190,66,'Accepted interval',8);label(157,49,'τ',8);label(231,49,'τ',8)
   label(193,5,'(b) Personal target to ideal',8)

def p(text):return Paragraph(text,body)
def eq(text,n):return Paragraph(text+f'&nbsp;&nbsp;({n})',equation)
sections=[
('A. System Overview',
'The platform provides six routines containing 13 asanas. NCERT instructions [1] define pose variants, alignment rules, and whether left/right holds are performed separately. Account-based profiles store comfortable movement measurements and session summaries. Camera frames and landmark inference remain in the browser; the Node.js/SQLite backend stores no video.'),
('B. Landmark Acquisition and Geometry',
'MediaPipe Pose Landmarker [2] supplies 33 landmarks. Required landmarks must have visibility and available presence scores ≥ 0.6 and remain inside the image. The prescribed front or side view is checked; unreliable frames are not scored. Normalized coordinates are converted to pixels, <i>P</i><sub>i</sub> = (<i>W x</i><sub>i</sub>, <i>H y</i><sub>i</sub>), to correct the aspect ratio. For joint vertex <i>B</i>, let <i>u</i> = <i>A</i> − <i>B</i> and <i>v</i> = <i>C</i> − <i>B</i>:'),
('C. Routine-Specific Personalization',
'Only movements relevant to the selected routine are calibrated, separately on each side. A comfortable 3-s hold provides at least 20 samples. Angular samples are accepted when <i>Q</i><sub>0.90</sub> − <i>Q</i><sub>0.10</sub> ≤ 14°. A comfortable measurement is estimated as'),
('D. Pose Recognition Before Evaluation',
'Broad rules test body orientation, limb arrangement, and relative hand/foot locations before precise alignment is scored. Scale-independent relations use ρ<sub>ab</sub> = &#8214;<i>P</i><sub>a</sub> − <i>P</i><sub>b</sub>&#8214; / &#8214;<i>P</i><sub>s</sub> − <i>P</i><sub>h</sub>&#8214;, where <i>s</i> and <i>h</i> denote shoulder and hip. Compatible reference images are processed using the same landmarker. For four visible joint-angle features, reference discrepancy is'),
('E. Alignment and Multimodal Feedback',
'For numeric ideal <i>I</i><sub>j</sub>, personalized target <i>T</i><sub>j</sub>, and observed angle θ<sub>j</sub>, the acceptable interval is'),
('F. Session Control and Scope',
'The in-range hold timer advances only while valid visibility <i>V</i>, recognized shape <i>R</i>, and all applicable alignment checks <i>E</i> hold (binary indicators):')]
story=[Paragraph('III. METHODOLOGY',section)]
for i,(title,text) in enumerate(sections):
 story.extend([Paragraph(title,head),p(text)])
 if i==0:story.extend([Diagram('flow'),Paragraph('Fig. 1. Routine workflow. Unreliable or unmatched shapes return to acquisition; the final rest leads to the saved session summary.',caption)])
 if i==1:story.extend([eq('θ<sub>ABC</sub> = (180/π) arccos[(<i>u</i>·<i>v</i>)/(&#8214;<i>u</i>&#8214;&#8214;<i>v</i>&#8214;)]',1),p('The cosine input is clipped to [−1, 1]; zero-length segments are rejected. Shoulder, elbow, hip, and knee angles use the corresponding three landmarks. Segment elevation is α = (180/π) atan2(|Δ<i>y</i>|, |Δ<i>x</i>|), assuming a level camera.')])
 if i==2:story.extend([eq('<i>C</i><sub>j</sub> = round(<i>Q</i><sub>p</sub>(<i>S</i><sub>j</sub>)),&nbsp; <i>p</i> = 0.25 or 0.75',2),p('The upper percentile represents increasing reach; the lower represents deeper folding. For increasing excursion, <i>T</i><sub>j</sub> = min(<i>C</i><sub>j</sub>, <i>I</i><sub>j</sub>). For a supine leg raise, <i>T</i><sub>hip</sub> = 180° − min(<i>C</i><sub>leg</sub>, <i>I</i><sub>leg</sub>); fixed positioning checks retain textbook targets. Skipped or expired checks exclude dependent holds. These measurements estimate task-specific reach, not clinical ROM.')])
 if i==3:story.extend([eq('<i>D</i> = (1/(4·180°)) Σ<sub>j=1</sub><sup>4</sup> |θ<sub>j</sub> − θ<sub>j</sub><sup>ref</sup>|',3),p('Recognition requires the broad rules and, when a usable reference exists, <i>D</i> &lt; 0.48. The candidate must remain stable for 3 s, with angular drift below 14° from its current stability anchor. Incompatible or low-confidence references use rules alone. This interpretable prototype avoids training KNN from one image per pose; recognition tolerates incomplete mobility.')])
 if i==4:story.extend([eq('[min(<i>T</i><sub>j</sub>, <i>I</i><sub>j</sub>) − τ<sub>j</sub>, max(<i>T</i><sub>j</sub>, <i>I</i><sub>j</sub>) + τ<sub>j</sub>]',4),p('Tolerances are 8° for joint/elevation checks, 10° for torso proxies, and 20° for inter-arm alignment. Where the textbook specifies no angle, individual excursion or relational rules replace a fabricated ideal. The first failed check produces one directional text cue; browser speech gives instructions and corrections with a 7-s cooldown and duplicate suppression.'),Diagram('geometry'),Paragraph('Fig. 2. Three-landmark joint geometry and a target-to-ideal interval; either endpoint may be numerically larger.',caption)])
 if i==5:story.extend([eq('<i>H</i>(<i>t</i> + Δ<i>t</i>) = <i>H</i>(<i>t</i>) + Δ<i>t</i> · <i>V R E</i>',5),p('After a 10–20-s hold, the system schedules 15 s of rest and 5 s of preparation before the next pose/side. Persistent tracking loss or shape mismatch returns to recognition. Summaries record completed holds and tracked/in-range time. Thresholds are provisional: side views assess visible limbs only, and 2D landmarks cannot establish spinal/cervical ROM, comfort, relaxation, or all floor-contact conditions. Recognition accuracy requires empirical validation.')])
story.extend([Paragraph('REFERENCES',section),Paragraph('[1] NCERT, <i>Yoga: A Healthy Way of Living, Upper Primary Stage</i>, 1st ed. New Delhi, India: NCERT, 2015.',refstyle),Paragraph('[2] Google AI Edge, “Pose landmark detection guide for Web,” developer documentation. [Online]. Available: developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js',refstyle)])
frames=[Frame(margin,bottom,cw,top-bottom,id='left',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0),Frame(margin+cw+gap,bottom,cw,top-bottom,id='right',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)]
doc=BaseDocTemplate(str(root/'local_documents/paper/yoga-methodology-ieee.pdf'),pagesize=(W,H),title='Methodology: Personalized Browser-Based Yoga Assistance',author='Capstone project',leftMargin=margin,rightMargin=margin,topMargin=54,bottomMargin=bottom)
doc.addPageTemplates(PageTemplate(id='IEEE',frames=frames))
doc.build(story)
