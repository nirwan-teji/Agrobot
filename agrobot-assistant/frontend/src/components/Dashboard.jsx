import React, { useState, useEffect } from 'react';
import { BarChart3, Leaf, Cloud, Settings, Home, TrendingUp, Plus, Loader } from 'lucide-react';
import CropMonitor from './CropMonitor';
import WeatherWidget from './WeatherWidget';
import AddCropModal from './AddCropModal';
import ApiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [recommendations, setRecommendations] = useState(null);
  const [userCrops, setUserCrops] = useState([]); // Start with empty array
  const [showAddCropModal, setShowAddCropModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { user, logout } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load AI recommendations
      try {
        const recs = await ApiService.getLatestRecommendations();
        setRecommendations(recs);
        console.log('Recommendations loaded:', recs);
      } catch (recError) {
        console.log('No recommendations found:', recError.message);
        setRecommendations(null);
      }
      
      // Start with empty crops - user will add them via + button
      setUserCrops([]);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCrop = async (cropData) => {
    try {
      // For now, add to local state (you can implement API later)
      const newCrop = {
        id: Date.now(),
        name: cropData.name,
        variety: cropData.variety,
        area: cropData.area,
        plantingDate: cropData.plantingDate,
        expectedHarvest: cropData.expectedHarvest,
        health: 'Good',
        moisture: Math.floor(Math.random() * 30) + 60, // Random 60-90%
        temperature: Math.floor(Math.random() * 10) + 20, // Random 20-30°C
        status: 'healthy',
        lastUpdated: 'Just now'
      };
      
      setUserCrops(prev => [...prev, newCrop]);
      setShowAddCropModal(false);
    } catch (error) {
      console.error('Error adding crop:', error);
    }
  };

  const handleRemoveCrop = (cropId) => {
    setUserCrops(prev => prev.filter(crop => crop.id !== cropId));
  };

  const getOverviewStats = () => {
    if (!recommendations) {
      return [
        { 
          title: 'Active Fields', 
          value: userCrops.length.toString(), 
          change: userCrops.length === 0 ? 'Add your first crop' : `${userCrops.length} crops monitored`, 
          trend: 'neutral', 
          icon: <Leaf className="stat-icon" /> 
        },
        { 
          title: 'Soil Health', 
          value: 'N/A', 
          change: 'Complete questionnaire for AI analysis', 
          trend: 'neutral', 
          icon: <TrendingUp className="stat-icon" /> 
        },
        { 
          title: 'Recommendations', 
          value: '0', 
          change: 'Generate first AI report', 
          trend: 'neutral', 
          icon: <Cloud className="stat-icon" /> 
        },
        { 
          title: 'Alerts', 
          value: '0', 
          change: 'No issues detected', 
          trend: 'up', 
          icon: <BarChart3 className="stat-icon" /> 
        }
      ];
    }

    return [
      { 
        title: 'Active Fields', 
        value: userCrops.length.toString(), 
        change: `${userCrops.length} crops monitored`, 
        trend: 'up', 
        icon: <Leaf className="stat-icon" /> 
      },
      { 
        title: 'Soil Health', 
        value: `${recommendations.soil_health_score.toFixed(1)}/10`, 
        change: 'Based on AI analysis', 
        trend: recommendations.soil_health_score > 7 ? 'up' : 'warning', 
        icon: <TrendingUp className="stat-icon" /> 
      },
      { 
        title: 'Recommendations', 
        value: recommendations.recommended_crops.length.toString(), 
        change: 'AI-generated crops', 
        trend: 'up', 
        icon: <Cloud className="stat-icon" /> 
      },
      { 
        title: 'Calendar Events', 
        value: recommendations.farming_calendar.length.toString(), 
        change: 'Upcoming activities', 
        trend: 'stable', 
        icon: <BarChart3 className="stat-icon" /> 
      }
    ];
  };

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <div className="loading-screen">
          <Loader className="loading-spinner" size={48} />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <Leaf className="logo-icon" />
            <span className="logo-text">AgroBot</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Home size={18} />
            <span>Overview</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'crops' ? 'active' : ''}`}
            onClick={() => setActiveTab('crops')}
          >
            <Leaf size={18} />
            <span>Crop Monitor</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'weather' ? 'active' : ''}`}
            onClick={() => setActiveTab('weather')}
          >
            <Cloud size={18} />
            <span>Weather</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={18} />
            <span>Analytics</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user?.full_name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="header-content">
            <h1 className="page-title">Agricultural Dashboard</h1>
            <p className="page-subtitle">
              {recommendations ? 'AI-powered insights for your farm' : 'Set up your first crop to get started'}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary">Export Data</button>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddCropModal(true)}
            >
              <Plus size={16} />
              Add Crop
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <p>{error}</p>
            <button onClick={loadDashboardData}>Retry</button>
          </div>
        )}

        <div className="content-area">
          {activeTab === 'overview' && (
            <div className="overview-section">
              <div className="overview-stats-horizontal">
                {getOverviewStats().map((stat, index) => (
                  <div key={index} className="overview-stat-card">
                    <div className="stat-header">
                      {stat.icon}
                      <span className="stat-title">{stat.title}</span>
                    </div>
                    <div className="stat-value">{stat.value}</div>
                    <div className={`stat-change ${stat.trend}`}>
                      {stat.change}
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashboard-widgets">
                <div className="widget-row">
                  <div className="widget-large">
                    <CropMonitor 
                      crops={userCrops} 
                      onAddCrop={() => setShowAddCropModal(true)}
                      onRemoveCrop={handleRemoveCrop}
                      recommendations={recommendations}
                    />
                  </div>
                  <div className="widget-medium">
                    <WeatherWidget />
                  </div>
                </div>
              </div>

              {recommendations && (
                <div className="ai-recommendations">
                  <h2>🤖 AI Recommendations</h2>
                  <div className="recommendations-grid">
                    <div className="recommendation-card">
                      <h3>🌱 Recommended Crops</h3>
                      <div className="crop-list">
                        {recommendations.recommended_crops.map((crop, index) => (
                          <div key={index} className="crop-item">
                            <div className="crop-details">
                              <strong>{crop.crop_name}</strong> - {crop.variety}
                              <span className="crop-season">{crop.sowing_season}</span>
                            </div>
                            <span className="profitability">Score: {crop.profitability_score}/10</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="recommendation-card">
                      <h3>📅 Upcoming Activities</h3>
                      <div className="activity-list">
                        {recommendations.farming_calendar.slice(0, 5).map((event, index) => (
                          <div key={index} className="activity-item">
                            <span className="activity-date">{new Date(event.date).toLocaleDateString()}</span>
                            <div className="activity-details">
                              <span className="activity-name">{event.activity}</span>
                              <span className="activity-desc">{event.description}</span>
                            </div>
                            <span className={`priority ${event.priority}`}>{event.priority}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="recommendation-card">
                      <h3>💡 Soil Improvement Tips</h3>
                      <div className="tips-list">
                        {recommendations.soil_improvement_tips.map((tip, index) => (
                          <div key={index} className="tip-item">
                            {tip}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="recommendation-card">
                      <h3>💧 Irrigation Recommendations</h3>
                      <div className="tips-list">
                        {recommendations.irrigation_recommendations.map((rec, index) => (
                          <div key={index} className="tip-item">
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!recommendations && (
                <div className="no-recommendations">
                  <div className="empty-state">
                    <Leaf size={64} className="empty-icon" />
                    <h3>No AI Recommendations Yet</h3>
                    <p>Complete the questionnaire to get personalized farming recommendations powered by AI.</p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => window.location.href = '/questionnaire'}
                    >
                      Complete Questionnaire
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'crops' && (
            <div className="crops-section">
              <CropMonitor 
                crops={userCrops} 
                onAddCrop={() => setShowAddCropModal(true)}
                onRemoveCrop={handleRemoveCrop}
                recommendations={recommendations}
              />
            </div>
          )}
          
          {activeTab === 'weather' && (
            <div className="weather-section">
              <WeatherWidget />
            </div>
          )}
          
          {activeTab === 'analytics' && (
            <div className="analytics-section">
              <div className="analytics-header">
                <h2>Analytics & Insights</h2>
                <p>Historical data and predictive analytics for better decision making</p>
              </div>
              <div className="analytics-placeholder">
                <div className="placeholder-content">
                  <BarChart3 size={48} className="placeholder-icon" />
                  <h3>Analytics Coming Soon</h3>
                  <p>Historical trends, yield predictions, and advanced analytics will be available here.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-section">
              <div className="settings-header">
                <h2>Settings</h2>
                <p>Manage your account and application preferences</p>
              </div>
              <div className="settings-content">
                <div className="setting-group">
                  <h3>Account Information</h3>
                  <div className="setting-item">
                    <label>Full Name</label>
                    <span>{user?.full_name}</span>
                  </div>
                  <div className="setting-item">
                    <label>Email</label>
                    <span>{user?.email}</span>
                  </div>
                </div>
                
                <div className="setting-group">
                  <h3>Preferences</h3>
                  <div className="setting-item">
                    <label>Temperature Unit</label>
                    <select defaultValue="celsius">
                      <option value="celsius">Celsius (°C)</option>
                      <option value="fahrenheit">Fahrenheit (°F)</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label>Area Unit</label>
                    <select defaultValue="hectare">
                      <option value="hectare">Hectare</option>
                      <option value="acre">Acre</option>
                      <option value="bigha">Bigha</option>
                    </select>
                  </div>
                </div>

                <div className="setting-group">
                  <h3>Notifications</h3>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      Weather Alerts
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      Crop Health Notifications
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      Calendar Reminders
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showAddCropModal && (
        <AddCropModal
          onClose={() => setShowAddCropModal(false)}
          onAdd={handleAddCrop}
          recommendations={recommendations}
        />
      )}
    </div>
  );
};

export default Dashboard;
