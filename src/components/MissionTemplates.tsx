
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Microscope, GraduationCap, Hammer, Lightbulb } from 'lucide-react';
import { DEFAULT_DONE_DEFINITION } from "@/lib/constants";

interface MissionTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  defaultTasks: {
    title: string;
    description: string;
    plan?: string;
    observations?: string;
  }[];
  estimatedDuration: string;
  color: string;
}

const templates: MissionTemplate[] = [
  {
    id: 'equipment-repair',
    name: 'Equipment Repair',
    description: 'Fix broken tools or equipment',
    icon: Wrench,
    category: 'Maintenance',
    estimatedDuration: '2-4 hours',
    color: 'bg-mission-maintenance',
    defaultTasks: [
      {
        title: 'Collaborate with AI on SOP best practices and ideas',
        description: 'Work with AI to optimize standard operating procedures',
        plan: 'Consult AI for industry best practices and process improvements'
      },
      {
        title: 'Gather Parts & Tools',
        description: 'Collect necessary repair materials',
        plan: 'List required parts and tools, then gather them from inventory'
      },
      {
        title: 'Diagnose Issue',
        description: 'Identify the root cause of the problem',
        plan: 'Inspect equipment and test components to find the fault'
      },
      {
        title: 'Perform Repair',
        description: 'Execute the repair work',
        plan: 'Replace or fix faulty components according to diagnosis'
      },
      {
        title: 'Test & Verify',
        description: 'Confirm repair is successful',
        plan: 'Run equipment tests to ensure proper operation'
      }
    ]
  },
  {
    id: 'research-project',
    name: 'Research Project',
    description: 'Conduct research or experiments',
    icon: Microscope,
    category: 'Research',
    estimatedDuration: '1-4 weeks',
    color: 'bg-mission-research',
    defaultTasks: [
      {
        title: 'Collaborate with AI on SOP best practices and ideas',
        description: 'Work with AI to optimize research methodology',
        plan: 'Consult AI for research best practices and methodology improvements'
      },
      {
        title: 'Literature Review',
        description: 'Research existing knowledge on the topic',
        plan: 'Search databases and review relevant publications'
      },
      {
        title: 'Design Experiment',
        description: 'Plan methodology and procedures',
        plan: 'Create detailed experimental protocol and safety procedures'
      },
      {
        title: 'Collect Data',
        description: 'Execute experiments and gather results',
        plan: 'Run experiments according to protocol and record data'
      },
      {
        title: 'Analyze Results',
        description: 'Process and interpret findings',
        plan: 'Analyze data using appropriate statistical methods'
      }
    ]
  },
  {
    id: 'training-session',
    name: 'Training Session',
    description: 'Organize training or educational activities',
    icon: GraduationCap,
    category: 'Education',
    estimatedDuration: '1-2 days',
    color: 'bg-mission-education',
    defaultTasks: [
      {
        title: 'Collaborate with AI on SOP best practices and ideas',
        description: 'Work with AI to optimize training methodology',
        plan: 'Consult AI for training best practices and curriculum improvements'
      },
      {
        title: 'Prepare Materials',
        description: 'Create training content and handouts',
        plan: 'Develop slides, handouts, and practical exercises'
      },
      {
        title: 'Schedule Session',
        description: 'Coordinate with participants',
        plan: 'Book venue and send invitations to participants'
      },
      {
        title: 'Conduct Training',
        description: 'Deliver the training session',
        plan: 'Present material and facilitate hands-on activities'
      },
      {
        title: 'Collect Feedback',
        description: 'Gather participant feedback',
        plan: 'Distribute and collect feedback forms and surveys'
      }
    ]
  },
  {
    id: 'construction-project',
    name: 'Construction Project',
    description: 'Build or construct something new',
    icon: Hammer,
    category: 'Construction',
    estimatedDuration: '1-2 weeks',
    color: 'bg-mission-construction',
    defaultTasks: [
      {
        title: 'Plan & Design',
        description: 'Create detailed construction plans',
        plan: 'Draft blueprints and create materials list'
      },
      {
        title: 'Prepare Site',
        description: 'Set up work area and safety measures',
        plan: 'Clear area, set up barriers, and organize tools'
      },
      {
        title: 'Construction Phase',
        description: 'Execute the building work',
        plan: 'Follow blueprints and build according to specifications'
      },
      {
        title: 'Final Inspection',
        description: 'Verify quality and safety',
        plan: 'Check all construction meets safety and quality standards'
      }
    ]
  },
  {
    id: 'custom',
    name: 'Custom Project',
    description: 'Start from scratch with your own structure',
    icon: Lightbulb,
    category: 'Custom',
    estimatedDuration: 'Variable',
    color: 'bg-mission-custom',
    defaultTasks: []
  }
];

interface MissionTemplatesProps {
  onSelectTemplate: (template: MissionTemplate) => void;
  onClose: () => void;
}

export function MissionTemplates({ onSelectTemplate, onClose }: MissionTemplatesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose a Project Template</h3>
        <p className="text-sm text-muted-foreground">
          Select a template to get started quickly, or choose custom to build from scratch.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <Card 
              key={template.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
              onClick={() => onSelectTemplate(template)}
            >
              <CardHeader className={`pb-3 ${template.color}`}>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-white/30">
                    <Icon className="h-6 w-6 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base text-foreground">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="secondary" 
                        className="text-xs bg-white/40 text-foreground border-white/40"
                      >
                        {template.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {template.estimatedDuration}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 bg-background">
                <CardDescription className="text-sm">
                  {template.description}
                </CardDescription>
                {template.defaultTasks.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {template.defaultTasks.length} default tasks included
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
