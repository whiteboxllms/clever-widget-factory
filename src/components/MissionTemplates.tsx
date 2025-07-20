
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Microscope, GraduationCap, Hammer, Lightbulb } from 'lucide-react';

interface MissionTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  defaultTasks: {
    title: string;
    description: string;
    done_definition: string;
  }[];
  estimatedDuration: string;
}

const templates: MissionTemplate[] = [
  {
    id: 'equipment-repair',
    name: 'Equipment Repair',
    description: 'Fix broken tools or equipment',
    icon: Wrench,
    category: 'Maintenance',
    estimatedDuration: '2-4 hours',
    defaultTasks: [
      {
        title: 'Gather Parts & Tools',
        description: 'Collect necessary repair materials',
        done_definition: 'All required parts and tools are available'
      },
      {
        title: 'Diagnose Issue',
        description: 'Identify the root cause of the problem',
        done_definition: 'Problem clearly identified and documented'
      },
      {
        title: 'Perform Repair',
        description: 'Execute the repair work',
        done_definition: 'Equipment functions as expected'
      },
      {
        title: 'Test & Verify',
        description: 'Confirm repair is successful',
        done_definition: 'Equipment passes all operational tests'
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
    defaultTasks: [
      {
        title: 'Literature Review',
        description: 'Research existing knowledge on the topic',
        done_definition: 'Comprehensive review completed and documented'
      },
      {
        title: 'Design Experiment',
        description: 'Plan methodology and procedures',
        done_definition: 'Experimental design approved and documented'
      },
      {
        title: 'Collect Data',
        description: 'Execute experiments and gather results',
        done_definition: 'All planned data collection completed'
      },
      {
        title: 'Analyze Results',
        description: 'Process and interpret findings',
        done_definition: 'Analysis complete with conclusions documented'
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
    defaultTasks: [
      {
        title: 'Prepare Materials',
        description: 'Create training content and handouts',
        done_definition: 'All training materials ready and tested'
      },
      {
        title: 'Schedule Session',
        description: 'Coordinate with participants',
        done_definition: 'Training scheduled with confirmed attendees'
      },
      {
        title: 'Conduct Training',
        description: 'Deliver the training session',
        done_definition: 'Training completed with all objectives covered'
      },
      {
        title: 'Collect Feedback',
        description: 'Gather participant feedback',
        done_definition: 'Feedback collected and summarized'
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
    defaultTasks: [
      {
        title: 'Plan & Design',
        description: 'Create detailed construction plans',
        done_definition: 'Plans approved and materials list finalized'
      },
      {
        title: 'Prepare Site',
        description: 'Set up work area and safety measures',
        done_definition: 'Site ready for construction with safety measures in place'
      },
      {
        title: 'Construction Phase',
        description: 'Execute the building work',
        done_definition: 'Construction completed according to plans'
      },
      {
        title: 'Final Inspection',
        description: 'Verify quality and safety',
        done_definition: 'Project passes all quality and safety checks'
      }
    ]
  },
  {
    id: 'custom',
    name: 'Custom Mission',
    description: 'Start from scratch with your own structure',
    icon: Lightbulb,
    category: 'Custom',
    estimatedDuration: 'Variable',
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
        <h3 className="text-lg font-semibold mb-2">Choose a Mission Template</h3>
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
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectTemplate(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {template.estimatedDuration}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
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
