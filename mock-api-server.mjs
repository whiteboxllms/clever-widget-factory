// Mock API server for development
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Mock data
const mockData = {
  tools: Array.from({ length: 50 }, (_, i) => ({
    id: `tool-${i}`,
    name: `Tool ${i}`,
    category: 'Equipment',
    status: 'active',
    serial_number: `SN${i}`,
    storage_location: 'Warehouse A'
  })),
  parts: Array.from({ length: 50 }, (_, i) => ({
    id: `part-${i}`,
    name: `Part ${i}`,
    category: 'Component',
    current_quantity: 10,
    minimum_quantity: 5
  })),
  checkouts: Array.from({ length: 35 }, (_, i) => ({
    id: `checkout-${i}`,
    tool_id: `tool-${i}`,
    user_name: `User ${i}`,
    user_id: `user-${i}`,
    checkout_date: new Date().toISOString(),
    is_returned: false
  })),
  issues: [],
  parts_orders: [],
  actions: [],
  missions: [],
  organization_members: []
};

// Generic endpoint handler
app.get('/api/:table', (req, res) => {
  const { table } = req.params;
  const data = mockData[table] || [];
  
  res.json({ data, error: null });
});

app.get('/api/:table/search', (req, res) => {
  const { table } = req.params;
  const { search } = req.query;
  const data = mockData[table] || [];
  
  const filtered = data.filter(item => 
    Object.values(item).some(value => 
      String(value).toLowerCase().includes(search.toLowerCase())
    )
  );
  
  res.json({ data: filtered, error: null });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
