import { useEffect, useState } from 'react';
import { supabase } from '@/lib/dbService';

export function DebugTest() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function test() {
      console.log('Testing dbService...');
      try {
        const result = await supabase.from('parts').select('*');
        console.log('Parts result:', result);
        setData(result);
      } catch (error) {
        console.error('Error:', error);
      }
      setLoading(false);
    }
    test();
  }, []);

  if (loading) return <div>Testing...</div>;

  return (
    <div>
      <h3>Debug Test</h3>
      <p>Parts count: {data?.data?.length || 0}</p>
      <p>Error: {data?.error?.message || 'None'}</p>
    </div>
  );
}
