import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, MenuItem, Select } from "@mui/material";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../../src/components/api";
import Logo from "../assets/Logo.png";

export default function OrdersRangeStats() {
  const [range, setRange] = useState("daily");
  const [data, setData] = useState([]);

  const fetchStats = async () => {
    try {
      const res = await api.get(`/orders/logs-status?range=${range}`);
      setData(res.data);
    } catch (error) {
      console.error("Error fetching range stats:", error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [range]);

  return (
    <Box>

      <img
      src={Logo}
      alt="Company Logo"
      style={{ width: 110, height: 110, display: "flex", marginLeft: "auto", marginRight: "auto" }}
      />
      
      <Typography variant="h5" color="black" fontWeight="bold" mt={3} mb={3} display={"flex"} justifyContent={"center"}>
        Order Statistics
      </Typography>

      <Select
        value={range}
        onChange={(e) => setRange(e.target.value)}
        sx={{ mb: 3, width: 200 }}
      >
        <MenuItem value="daily">Daily</MenuItem>
        <MenuItem value="weekly">Weekly</MenuItem>
        <MenuItem value="monthly">Monthly</MenuItem>
      </Select>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ width: "100%", height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="orders" stroke="#0ABE51" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </Box>
  );
}
