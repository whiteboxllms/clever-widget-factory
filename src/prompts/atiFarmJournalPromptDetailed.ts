export const atiFarmJournalPromptDetailed = `
You are creating a professional farm journal report for the Philippine Agricultural Training Institute (ATI) partnership application. This report should showcase sustainable farming practices, operational excellence, and community impact.

## Context Data
You will receive farm activity data in JSON format containing:
- Completed actions and tasks
- Issues created and resolved  
- New tools/assets added
- Stock/inventory changes
- Implementation updates
- Action scores and evaluations

## Report Requirements

### 1. HTML Structure
Generate a complete HTML document with:
- Professional styling using inline CSS
- Responsive design for mobile and desktop
- Clean, agricultural-themed color scheme (greens, earth tones)
- Proper typography and spacing

### 2. Content Sections

#### A. Executive Summary
- Brief overview of the reporting period
- Key achievements and milestones
- Sustainability highlights
- Community impact metrics

#### B. Daily Activities Log
- Chronological breakdown of farm activities
- Task completion with photos/evidence
- Team collaboration and leadership
- Problem-solving and innovation

#### C. Sustainability Practices
- Environmental stewardship activities
- Resource conservation efforts
- Waste reduction and recycling
- Soil health and crop rotation

#### D. Infrastructure & Equipment
- New tools and equipment acquired
- Maintenance and care practices
- Safety protocols and training
- Technology integration

#### E. Inventory Management
- Stock additions and usage
- Supply chain efficiency
- Cost management
- Resource optimization

#### F. Issue Resolution
- Problems identified and solved
- Preventive measures implemented
- Continuous improvement processes
- Quality assurance practices

#### G. Team Development
- Skills development and training
- Leadership opportunities
- Community engagement
- Knowledge sharing

### 3. Styling Guidelines

Use this CSS framework:
\`\`\`css
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #2c3e50;
  background-color: #f8f9fa;
  margin: 0;
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
  color: white;
  padding: 30px;
  text-align: center;
}

.section {
  padding: 30px;
  border-bottom: 1px solid #ecf0f1;
}

.section:last-child {
  border-bottom: none;
}

.activity-card {
  background: #f8f9fa;
  border-left: 4px solid #27ae60;
  padding: 20px;
  margin: 15px 0;
  border-radius: 5px;
}

.highlight {
  background: #e8f5e8;
  padding: 15px;
  border-radius: 5px;
  margin: 10px 0;
}

.metric {
  display: inline-block;
  background: #3498db;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  margin: 5px;
  font-size: 14px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin: 15px 0;
}

.photo-item {
  text-align: center;
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
}

.photo-item img {
  max-width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 5px;
}

.timeline {
  position: relative;
  padding-left: 30px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #27ae60;
}

.timeline-item {
  position: relative;
  margin-bottom: 30px;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -22px;
  top: 20px;
  width: 12px;
  height: 12px;
  background: #27ae60;
  border-radius: 50%;
  border: 3px solid white;
}

@media (max-width: 768px) {
  .container {
    margin: 10px;
    border-radius: 5px;
  }
  
  .header, .section {
    padding: 20px;
  }
  
  .photo-grid {
    grid-template-columns: 1fr;
  }
}
\`\`\`

### 4. Content Guidelines

#### Tone and Style
- Professional yet warm and approachable
- Focus on sustainability and community impact
- Highlight innovation and best practices
- Emphasize continuous improvement
- Showcase Filipino agricultural values

#### Data Interpretation
- Transform raw data into meaningful narratives
- Highlight environmental stewardship
- Emphasize team collaboration and leadership
- Show problem-solving and innovation
- Demonstrate operational excellence

#### Visual Elements
- Use photos effectively with captions
- Create visual hierarchy with headings
- Include metrics and statistics
- Use icons and visual indicators
- Ensure mobile-friendly layout

### 5. Output Format

Return a complete HTML document that includes:
- DOCTYPE declaration
- Complete head section with meta tags
- Inline CSS styling
- Structured content sections
- Responsive design
- Professional presentation

### 6. Special Considerations for ATI

- Emphasize educational value and knowledge sharing
- Highlight sustainable farming practices
- Show community engagement and impact
- Demonstrate innovation and technology use
- Showcase capacity building and training
- Emphasize environmental stewardship
- Highlight economic sustainability
- Show commitment to agricultural development

Generate a comprehensive, professional farm journal that positions this farm as an ideal partner for ATI's agricultural development programs.
`;

export default atiFarmJournalPromptDetailed;