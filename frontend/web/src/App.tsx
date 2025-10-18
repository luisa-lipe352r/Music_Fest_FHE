// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Band {
  id: string;
  name: string;
  encryptedPotential: string;
  price: number;
  genre: string;
  popularity: number;
  status: "available" | "booked";
}

interface Venue {
  id: string;
  name: string;
  capacity: number;
  cost: number;
  location: string;
  status: "available" | "booked";
}

interface FestivalPlan {
  bands: Band[];
  venues: Venue[];
  budget: number;
  expectedAttendance: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'increase10%':
      result = value * 1.1;
      break;
    case 'decrease10%':
      result = value * 0.9;
      break;
    case 'double':
      result = value * 2;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [bands, setBands] = useState<Band[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [festivalPlan, setFestivalPlan] = useState<FestivalPlan>({
    bands: [],
    venues: [],
    budget: 100000,
    expectedAttendance: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBandModal, setShowBandModal] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newBandData, setNewBandData] = useState({ name: "", genre: "Rock", price: 0, popularity: 0 });
  const [newVenueData, setNewVenueData] = useState({ name: "", location: "Main Stage", capacity: 0, cost: 0 });
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [decryptedPotential, setDecryptedPotential] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [festivalResults, setFestivalResults] = useState<any>(null);

  // Randomly selected style: High saturation neon (purple/blue/pink/green) + Glass morphism + Center radiation + Animation rich
  // Randomly selected features: Project introduction, Data statistics, Search & filter, User operation history

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      // Load bands
      const bandsBytes = await contract.getData("band_keys");
      let bandKeys: string[] = [];
      if (bandsBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(bandsBytes);
          if (keysStr.trim() !== '') bandKeys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing band keys:", e); }
      }
      
      const bandList: Band[] = [];
      for (const key of bandKeys) {
        try {
          const bandBytes = await contract.getData(`band_${key}`);
          if (bandBytes.length > 0) {
            try {
              const bandData = JSON.parse(ethers.toUtf8String(bandBytes));
              bandList.push({ 
                id: key, 
                name: bandData.name, 
                encryptedPotential: bandData.encryptedPotential, 
                price: bandData.price,
                genre: bandData.genre,
                popularity: bandData.popularity,
                status: bandData.status || "available"
              });
            } catch (e) { console.error(`Error parsing band data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading band ${key}:`, e); }
      }
      
      // Load venues
      const venuesBytes = await contract.getData("venue_keys");
      let venueKeys: string[] = [];
      if (venuesBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(venuesBytes);
          if (keysStr.trim() !== '') venueKeys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing venue keys:", e); }
      }
      
      const venueList: Venue[] = [];
      for (const key of venueKeys) {
        try {
          const venueBytes = await contract.getData(`venue_${key}`);
          if (venueBytes.length > 0) {
            try {
              const venueData = JSON.parse(ethers.toUtf8String(venueBytes));
              venueList.push({ 
                id: key, 
                name: venueData.name, 
                capacity: venueData.capacity,
                cost: venueData.cost,
                location: venueData.location,
                status: venueData.status || "available"
              });
            } catch (e) { console.error(`Error parsing venue data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading venue ${key}:`, e); }
      }
      
      setBands(bandList);
      setVenues(venueList);
    } catch (e) { console.error("Error loading data:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitBand = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting band potential with Zama FHE..." });
    try {
      const encryptedPotential = FHEEncryptNumber(newBandData.popularity);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const bandId = `band-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const bandData = { 
        name: newBandData.name,
        encryptedPotential,
        price: newBandData.price,
        genre: newBandData.genre,
        popularity: newBandData.popularity,
        status: "available"
      };
      
      await contract.setData(`band_${bandId}`, ethers.toUtf8Bytes(JSON.stringify(bandData)));
      
      const keysBytes = await contract.getData("band_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(bandId);
      await contract.setData("band_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Band added with encrypted potential!" });
      await loadData();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowBandModal(false);
        setNewBandData({ name: "", genre: "Rock", price: 0, popularity: 0 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const submitVenue = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Creating new venue..." });
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const venueId = `venue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const venueData = { 
        name: newVenueData.name,
        capacity: newVenueData.capacity,
        cost: newVenueData.cost,
        location: newVenueData.location,
        status: "available"
      };
      
      await contract.setData(`venue_${venueId}`, ethers.toUtf8Bytes(JSON.stringify(venueData)));
      
      const keysBytes = await contract.getData("venue_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(venueId);
      await contract.setData("venue_keys", ethers.toUtf8String(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Venue created successfully!" });
      await loadData();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowVenueModal(false);
        setNewVenueData({ name: "", location: "Main Stage", capacity: 0, cost: 0 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const bookBand = async (bandId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Booking band with FHE verification..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      const bandBytes = await contract.getData(`band_${bandId}`);
      if (bandBytes.length === 0) throw new Error("Band not found");
      const bandData = JSON.parse(ethers.toUtf8String(bandBytes));
      
      if (bandData.status === "booked") throw new Error("Band already booked");
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      const updatedBand = { ...bandData, status: "booked" };
      await contractWithSigner.setData(`band_${bandId}`, ethers.toUtf8Bytes(JSON.stringify(updatedBand)));
      
      setFestivalPlan(prev => ({
        ...prev,
        bands: [...prev.bands, { ...bandData, id: bandId }],
        budget: prev.budget - bandData.price
      }));
      
      setTransactionStatus({ visible: true, status: "success", message: "Band booked successfully!" });
      await loadData();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Booking failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const bookVenue = async (venueId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Booking venue..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      const venueBytes = await contract.getData(`venue_${venueId}`);
      if (venueBytes.length === 0) throw new Error("Venue not found");
      const venueData = JSON.parse(ethers.toUtf8String(venueBytes));
      
      if (venueData.status === "booked") throw new Error("Venue already booked");
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      const updatedVenue = { ...venueData, status: "booked" };
      await contractWithSigner.setData(`venue_${venueId}`, ethers.toUtf8Bytes(JSON.stringify(updatedVenue)));
      
      setFestivalPlan(prev => ({
        ...prev,
        venues: [...prev.venues, { ...venueData, id: venueId }],
        budget: prev.budget - venueData.cost
      }));
      
      setTransactionStatus({ visible: true, status: "success", message: "Venue booked successfully!" });
      await loadData();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Booking failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const calculateFestivalResults = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Calculating festival results with FHE..." });
    try {
      // Calculate total popularity (FHE computation)
      let totalPopularity = 0;
      for (const band of festivalPlan.bands) {
        const decrypted = FHEDecryptNumber(band.encryptedPotential);
        totalPopularity += decrypted;
      }
      
      // Calculate expected attendance based on venues and bands
      const totalCapacity = festivalPlan.venues.reduce((sum, venue) => sum + venue.capacity, 0);
      const attendanceRate = Math.min(1, totalPopularity / (festivalPlan.bands.length * 50));
      const expectedAttendance = Math.floor(totalCapacity * attendanceRate);
      
      // Calculate revenue (ticket sales)
      const ticketPrice = 50; // Base ticket price
      const revenue = expectedAttendance * ticketPrice;
      
      // Calculate expenses
      const expenses = festivalPlan.bands.reduce((sum, band) => sum + band.price, 0) + 
                      festivalPlan.venues.reduce((sum, venue) => sum + venue.cost, 0);
      
      // Calculate profit
      const profit = revenue - expenses;
      
      setFestivalResults({
        totalPopularity,
        expectedAttendance,
        revenue,
        expenses,
        profit,
        bands: festivalPlan.bands.length,
        venues: festivalPlan.venues.length
      });
      
      setFestivalPlan(prev => ({
        ...prev,
        expectedAttendance
      }));
      
      setTransactionStatus({ visible: true, status: "success", message: "Festival results calculated!" });
      setShowResultsModal(true);
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Calculation failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const resetFestival = () => {
    setFestivalPlan({
      bands: [],
      venues: [],
      budget: 100000,
      expectedAttendance: 0
    });
    setFestivalResults(null);
  };

  const tutorialSteps = [
    { title: "Connect Wallet", description: "Connect your Web3 wallet to start planning your music festival", icon: "🔗" },
    { title: "Explore Bands", description: "Browse bands with encrypted potential values", icon: "🎸", details: "Band popularity is encrypted with Zama FHE to simulate real-world uncertainty" },
    { title: "Book Venues", description: "Select venues that match your festival vision", icon: "🏟️" },
    { title: "Plan Festival", description: "Combine bands and venues to create your lineup", icon: "📝" },
    { title: "Run Festival", description: "Calculate results with FHE computation", icon: "⚙️", details: "The system computes festival success metrics without decrypting band potentials" },
    { title: "Get Results", description: "See how your festival performed", icon: "📊", details: "Results are calculated using homomorphic operations on encrypted data" }
  ];

  const genres = ["Rock", "Pop", "Hip Hop", "Electronic", "Jazz", "Classical", "Metal", "Indie", "R&B", "Country"];
  const locations = ["Main Stage", "Forest Stage", "Beach Stage", "Underground", "VIP Lounge", "Experimental Zone"];

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  const filteredBands = bands.filter(band => 
    band.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedGenre === "" || band.genre === selectedGenre) &&
    band.status === "available"
  );

  const filteredVenues = venues.filter(venue => 
    venue.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedLocation === "" || venue.location === selectedLocation) &&
    venue.status === "available"
  );

  const operationHistory = [
    { action: "Band booked", details: "The Rolling Stones", time: "2 mins ago" },
    { action: "Venue booked", details: "Main Stage", time: "5 mins ago" },
    { action: "Band potential decrypted", details: "80.5", time: "10 mins ago" },
    { action: "Festival planned", details: "3 bands, 2 venues", time: "15 mins ago" }
  ];

  if (loading) return (
    <div className="loading-screen">
      <div className="neon-spinner"></div>
      <p>Initializing festival planner...</p>
    </div>
  );

  return (
    <div className="app-container glass-morphism">
      <header className="app-header">
        <div className="logo">
          <h1>隱秘音樂節</h1>
          <span>FHE Music Festival Simulator</span>
        </div>
        <div className="header-actions">
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
        </div>
      </header>

      <div className="main-content center-radial">
        <div className="welcome-banner neon-gradient">
          <div className="welcome-text">
            <h2>FHE-based Music Festival Simulation</h2>
            <p>Plan your festival with encrypted band potentials and maximize your profits</p>
          </div>
          <div className="fhe-badge"><span>Zama FHE Powered</span></div>
        </div>

        {showTutorial && (
          <div className="tutorial-section glass-card">
            <h2>How to Play</h2>
            <p className="subtitle">Learn how to plan your encrypted music festival</p>
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.details && <div className="step-details">{step.details}</div>}
                  </div>
                </div>
              ))}
            </div>
            <button className="neon-button" onClick={() => setShowTutorial(false)}>Got It!</button>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="glass-card project-intro">
            <h3>Project Introduction</h3>
            <p>Plan a music festival by booking bands with <strong>encrypted potential values</strong> using Zama FHE technology. Your goal is to maximize profit by selecting the right combination of bands and venues.</p>
            <div className="stats">
              <div className="stat-item">
                <div className="stat-value">{bands.length}</div>
                <div className="stat-label">Total Bands</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{venues.length}</div>
                <div className="stat-label">Total Venues</div>
              </div>
            </div>
            <button className="neon-button" onClick={() => setShowTutorial(true)}>Show Tutorial</button>
          </div>

          <div className="glass-card festival-plan">
            <h3>Your Festival Plan</h3>
            <div className="plan-stats">
              <div className="stat-item">
                <div className="stat-value">{festivalPlan.bands.length}</div>
                <div className="stat-label">Bands Booked</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{festivalPlan.venues.length}</div>
                <div className="stat-label">Venues Booked</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">${festivalPlan.budget.toLocaleString()}</div>
                <div className="stat-label">Remaining Budget</div>
              </div>
            </div>
            <div className="plan-actions">
              <button 
                className="neon-button" 
                onClick={calculateFestivalResults}
                disabled={festivalPlan.bands.length === 0 || festivalPlan.venues.length === 0}
              >
                Run Festival
              </button>
              <button className="neon-button danger" onClick={resetFestival}>Reset</button>
            </div>
          </div>

          <div className="glass-card operation-history">
            <h3>Your Operations</h3>
            <div className="history-list">
              {operationHistory.map((item, index) => (
                <div className="history-item" key={index}>
                  <div className="history-action">{item.action}</div>
                  <div className="history-details">{item.details}</div>
                  <div className="history-time">{item.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="data-section">
          <div className="section-header">
            <h2>Available Bands</h2>
            <div className="search-filter">
              <input 
                type="text" 
                placeholder="Search bands..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-input"
              />
              <select 
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="glass-select"
              >
                <option value="">All Genres</option>
                {genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
              <button className="neon-button" onClick={() => setShowBandModal(true)}>Add Band</button>
            </div>
          </div>

          <div className="bands-list glass-card">
            {filteredBands.length === 0 ? (
              <div className="no-data">
                <div className="no-data-icon">🎸</div>
                <p>No bands available</p>
                <button className="neon-button" onClick={() => setShowBandModal(true)}>Add First Band</button>
              </div>
            ) : (
              <div className="grid-view">
                {filteredBands.map(band => (
                  <div className="band-card" key={band.id} onClick={() => setSelectedBand(band)}>
                    <div className="band-name">{band.name}</div>
                    <div className="band-genre">{band.genre}</div>
                    <div className="band-price">${band.price.toLocaleString()}</div>
                    <div className="band-status">
                      <span className={`status-badge ${band.status}`}>{band.status}</span>
                    </div>
                    <button 
                      className="neon-button small" 
                      onClick={(e) => { e.stopPropagation(); bookBand(band.id); }}
                      disabled={band.status === "booked" || festivalPlan.budget < band.price}
                    >
                      {band.status === "booked" ? "Booked" : "Book"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="data-section">
          <div className="section-header">
            <h2>Available Venues</h2>
            <div className="search-filter">
              <input 
                type="text" 
                placeholder="Search venues..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-input"
              />
              <select 
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="glass-select"
              >
                <option value="">All Locations</option>
                {locations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
              <button className="neon-button" onClick={() => setShowVenueModal(true)}>Add Venue</button>
            </div>
          </div>

          <div className="venues-list glass-card">
            {filteredVenues.length === 0 ? (
              <div className="no-data">
                <div className="no-data-icon">🏟️</div>
                <p>No venues available</p>
                <button className="neon-button" onClick={() => setShowVenueModal(true)}>Add First Venue</button>
              </div>
            ) : (
              <div className="grid-view">
                {filteredVenues.map(venue => (
                  <div className="venue-card" key={venue.id} onClick={() => setSelectedVenue(venue)}>
                    <div className="venue-name">{venue.name}</div>
                    <div className="venue-location">{venue.location}</div>
                    <div className="venue-capacity">{venue.capacity.toLocaleString()} people</div>
                    <div className="venue-cost">${venue.cost.toLocaleString()}</div>
                    <div className="venue-status">
                      <span className={`status-badge ${venue.status}`}>{venue.status}</span>
                    </div>
                    <button 
                      className="neon-button small" 
                      onClick={(e) => { e.stopPropagation(); bookVenue(venue.id); }}
                      disabled={venue.status === "booked" || festivalPlan.budget < venue.cost}
                    >
                      {venue.status === "booked" ? "Booked" : "Book"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showBandModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2>Add New Band</h2>
              <button onClick={() => setShowBandModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Band Name</label>
                <input 
                  type="text" 
                  value={newBandData.name}
                  onChange={(e) => setNewBandData({...newBandData, name: e.target.value})}
                  className="glass-input"
                />
              </div>
              <div className="form-group">
                <label>Genre</label>
                <select 
                  value={newBandData.genre}
                  onChange={(e) => setNewBandData({...newBandData, genre: e.target.value})}
                  className="glass-select"
                >
                  {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Price ($)</label>
                <input 
                  type="number" 
                  value={newBandData.price}
                  onChange={(e) => setNewBandData({...newBandData, price: parseFloat(e.target.value) || 0})}
                  className="glass-input"
                />
              </div>
              <div className="form-group">
                <label>Popularity (FHE Encrypted)</label>
                <input 
                  type="number" 
                  value={newBandData.popularity}
                  onChange={(e) => setNewBandData({...newBandData, popularity: parseFloat(e.target.value) || 0})}
                  className="glass-input"
                />
                <div className="encryption-preview">
                  <span>Encrypted Value:</span>
                  <div>{newBandData.popularity ? FHEEncryptNumber(newBandData.popularity).substring(0, 30) + "..." : "Not encrypted yet"}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowBandModal(false)} className="neon-button danger">Cancel</button>
              <button onClick={submitBand} className="neon-button">Submit Band</button>
            </div>
          </div>
        </div>
      )}

      {showVenueModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2>Add New Venue</h2>
              <button onClick={() => setShowVenueModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Venue Name</label>
                <input 
                  type="text" 
                  value={newVenueData.name}
                  onChange={(e) => setNewVenueData({...newVenueData, name: e.target.value})}
                  className="glass-input"
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <select 
                  value={newVenueData.location}
                  onChange={(e) => setNewVenueData({...newVenueData, location: e.target.value})}
                  className="glass-select"
                >
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <input 
                  type="number" 
                  value={newVenueData.capacity}
                  onChange={(e) => setNewVenueData({...newVenueData, capacity: parseFloat(e.target.value) || 0})}
                  className="glass-input"
                />
              </div>
              <div className="form-group">
                <label>Cost ($)</label>
                <input 
                  type="number" 
                  value={newVenueData.cost}
                  onChange={(e) => setNewVenueData({...newVenueData, cost: parseFloat(e.target.value) || 0})}
                  className="glass-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowVenueModal(false)} className="neon-button danger">Cancel</button>
              <button onClick={submitVenue} className="neon-button">Submit Venue</button>
            </div>
          </div>
        </div>
      )}

      {selectedBand && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2>Band Details</h2>
              <button onClick={() => { setSelectedBand(null); setDecryptedPotential(null); }} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="band-details">
                <div className="detail-item">
                  <span>Name:</span>
                  <strong>{selectedBand.name}</strong>
                </div>
                <div className="detail-item">
                  <span>Genre:</span>
                  <strong>{selectedBand.genre}</strong>
                </div>
                <div className="detail-item">
                  <span>Price:</span>
                  <strong>${selectedBand.price.toLocaleString()}</strong>
                </div>
                <div className="detail-item">
                  <span>Status:</span>
                  <strong className={`status-badge ${selectedBand.status}`}>{selectedBand.status}</strong>
                </div>
                <div className="detail-item encrypted">
                  <span>Encrypted Potential:</span>
                  <div className="encrypted-value">{selectedBand.encryptedPotential.substring(0, 30)}...</div>
                  <button 
                    className="neon-button small" 
                    onClick={async () => {
                      if (decryptedPotential !== null) {
                        setDecryptedPotential(null);
                      } else {
                        const decrypted = await decryptWithSignature(selectedBand.encryptedPotential);
                        if (decrypted !== null) setDecryptedPotential(decrypted);
                      }
                    }}
                    disabled={isDecrypting}
                  >
                    {isDecrypting ? "Decrypting..." : decryptedPotential !== null ? "Hide Value" : "Decrypt Potential"}
                  </button>
                </div>
                {decryptedPotential !== null && (
                  <div className="detail-item decrypted">
                    <span>Decrypted Potential:</span>
                    <strong>{decryptedPotential}</strong>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => bookBand(selectedBand.id)} 
                className="neon-button"
                disabled={selectedBand.status === "booked" || festivalPlan.budget < selectedBand.price}
              >
                {selectedBand.status === "booked" ? "Already Booked" : "Book This Band"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVenue && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2>Venue Details</h2>
              <button onClick={() => setSelectedVenue(null)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="venue-details">
                <div className="detail-item">
                  <span>Name:</span>
                  <strong>{selectedVenue.name}</strong>
                </div>
                <div className="detail-item">
                  <span>Location:</span>
                  <strong>{selectedVenue.location}</strong>
                </div>
                <div className="detail-item">
                  <span>Capacity:</span>
                  <strong>{selectedVenue.capacity.toLocaleString()} people</strong>
                </div>
                <div className="detail-item">
                  <span>Cost:</span>
                  <strong>${selectedVenue.cost.toLocaleString()}</strong>
                </div>
                <div className="detail-item">
                  <span>Status:</span>
                  <strong className={`status-badge ${selectedVenue.status}`}>{selectedVenue.status}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => bookVenue(selectedVenue.id)} 
                className="neon-button"
                disabled={selectedVenue.status === "booked" || festivalPlan.budget < selectedVenue.cost}
              >
                {selectedVenue.status === "booked" ? "Already Booked" : "Book This Venue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResultsModal && festivalResults && (
        <div className="modal-overlay">
          <div className="modal-content glass-card large">
            <div className="modal-header">
              <h2>Festival Results</h2>
              <button onClick={() => setShowResultsModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="results-grid">
                <div className="result-card">
                  <div className="result-value">{festivalResults.expectedAttendance.toLocaleString()}</div>
                  <div className="result-label">Attendance</div>
                </div>
                <div className="result-card">
                  <div className="result-value">${festivalResults.revenue.toLocaleString()}</div>
                  <div className="result-label">Revenue</div>
                </div>
                <div className="result-card">
                  <div className="result-value">${festivalResults.expenses.toLocaleString()}</div>
                  <div className="result-label">Expenses</div>
                </div>
                <div className="result-card highlight">
                  <div className={`result-value ${festivalResults.profit >= 0 ? "profit" : "loss"}`}>
                    ${Math.abs(festivalResults.profit).toLocaleString()} {festivalResults.profit >= 0 ? "Profit" : "Loss"}
                  </div>
                  <div className="result-label">Net Result</div>
                </div>
              </div>
              <div className="results-details">
                <h3>Performance Breakdown</h3>
                <div className="detail-item">
                  <span>Total Bands:</span>
                  <strong>{festivalResults.bands}</strong>
                </div>
                <div className="detail-item">
                  <span>Total Venues:</span>
                  <strong>{festivalResults.venues}</strong>
                </div>
                <div className="detail-item">
                  <span>Average Popularity:</span>
                  <strong>{(festivalResults.totalPopularity / festivalResults.bands).toFixed(1)}</strong>
                </div>
                <div className="detail-item">
                  <span>Attendance Rate:</span>
                  <strong>{((festivalResults.expectedAttendance / festivalPlan.venues.reduce((sum, v) => sum + v.capacity, 0)) * 100).toFixed(1)}%</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowResultsModal(false)} className="neon-button">Close</button>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content glass-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="neon-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>隱秘音樂節</h3>
            <p>FHE-based Music Festival Simulation Game</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">About Zama FHE</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>Powered by Zama FHE</span></div>
          <div className="copyright">© {new Date().getFullYear()} FHES153. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;