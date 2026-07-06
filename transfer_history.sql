
-- Create transfer_history table
CREATE TABLE IF NOT EXISTS transfer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    req_no TEXT,
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    transferred_by TEXT NOT NULL,
    items JSONB NOT NULL,
    program TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Copy existing completed internal transfers to the new history table
INSERT INTO transfer_history (req_no, transfer_date, from_location, to_location, transferred_by, items, program, created_at)
SELECT 
    req_no, 
    COALESCE(request_date, created_at), 
    from_location, 
    to_location, 
    created_by, 
    json_build_array(json_build_object('item_code', item_code, 'item_name', item_name, 'quantity', quantity)),
    program,
    created_at
FROM transfer_requests
WHERE status = 'Completed'
ON CONFLICT DO NOTHING;

-- Note: After verifying the history, you can drop the old internal table if desired
-- DROP TABLE IF EXISTS transfer_requests;
