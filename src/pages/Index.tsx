import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Asset Tracker</CardTitle>
          <p className="text-muted-foreground">Manage your assets and stock efficiently</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => navigate('/dashboard')} 
            className="w-full"
            size="lg"
          >
            Go to Dashboard
          </Button>
          <Button 
            onClick={() => navigate('/combined-assets')} 
            variant="outline" 
            className="w-full"
            size="lg"
          >
            Combined Assets
          </Button>
          <Button 
            onClick={() => navigate('/tools')} 
            variant="outline" 
            className="w-full"
            size="lg"
          >
            View Assets
          </Button>
          <Button 
            onClick={() => navigate('/inventory')} 
            variant="outline" 
            className="w-full"
            size="lg"
          >
            Manage Stock
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
