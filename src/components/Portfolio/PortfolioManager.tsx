import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Star, 
  Image, 
  FileText, 
  Award, 
  Briefcase,
  Save,
  X,
  Loader,
  AlertCircle,
  CheckCircle,
  Upload
} from 'lucide-react';
import { PortfolioItem } from '../../types';

interface PortfolioManagerProps {
  developerId: string;
  isEditable?: boolean;
  showTitle?: boolean; // New prop to control title display
}

export const PortfolioManager: React.FC<PortfolioManagerProps> = ({ 
  developerId, 
  isEditable: isEditableProp,
  showTitle = true // Default to showing title
}) => {
  const { userProfile, user } = useAuth(); // Added user for direct ID comparison

  // Determine editability:
  // 1. If isEditableProp is explicitly passed, respect it.
  // 2. Otherwise, if user is logged in and their ID matches developerId, it's editable.
  const isCurrentUserProfile = userProfile?.id === developerId;
  const isEditable = isEditableProp !== undefined ? isEditableProp : isCurrentUserProfile;

  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    image_url: '',
    category: 'project' as 'project' | 'article' | 'certification' | 'other',
    technologies: [] as string[],
    featured: false
  });

  const [newTechnology, setNewTechnology] = useState('');

  useEffect(() => {
    fetchPortfolioItems();
  }, [developerId]);

  const fetchPortfolioItems = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('developer_id', developerId)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPortfolioItems(data || []);
    } catch (error: any) {
      console.error('Error fetching portfolio items:', error);
      setError(error.message || 'Failed to load portfolio items');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      url: '',
      image_url: '',
      category: 'project',
      technologies: [],
      featured: false
    });
    setNewTechnology('');
    setEditingItem(null);
    setShowForm(false);
  };

  const handleEdit = (item: PortfolioItem) => {
    setFormData({
      title: item.title,
      description: item.description || '',
      url: item.url || '',
      image_url: item.image_url || '',
      category: item.category,
      technologies: [...item.technologies],
      featured: item.featured
    });
    setEditingItem(item);
    setShowForm(true);
  };

  const addTechnology = () => {
    if (newTechnology.trim() && !formData.technologies.includes(newTechnology.trim())) {
      setFormData(prev => ({
        ...prev,
        technologies: [...prev.technologies, newTechnology.trim()]
      }));
      setNewTechnology('');
    }
  };

  const removeTechnology = (tech: string) => {
    setFormData(prev => ({
      ...prev,
      technologies: prev.technologies.filter(t => t !== tech)
    }));
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Image file size must be less than 5MB');
      setUploading(false);
      setSelectedFile(null);
      return;
    }
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${developerId}/${fileName}`;
      
      // Upload the file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('portfolio-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('portfolio-images')
        .getPublicUrl(filePath);
      
      // Update the form data with the image URL
      setFormData(prev => ({
        ...prev,
        image_url: publicUrl
      }));
      
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setError(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      setSaving(true);
      setError('');

      // Don't proceed if an image is still uploading
      if (uploading) {
        setError('Please wait for the image to finish uploading');
        setSaving(false);
        return;
      }

      const itemData = {
        developer_id: developerId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        url: formData.url.trim() || null,
        image_url: formData.image_url.trim() || null,
        category: formData.category,
        technologies: formData.technologies,
        featured: formData.featured
      };

      // If this item is being marked as featured, unfeature other items first
      if (itemData.featured) {
        // Get ID of current item if editing, null if new
        const currentItemId = editingItem ? editingItem.id : null;

        // Find any other item that is currently featured
        const { data: currentlyFeaturedItems, error: fetchFeaturedError } = await supabase
          .from('portfolio_items')
          .select('id')
          .eq('developer_id', developerId)
          .eq('featured', true);

        if (fetchFeaturedError) throw fetchFeaturedError;

        for (const featuredItem of currentlyFeaturedItems) {
          // Unfeature it, unless it's the current item already being saved as featured
          if (featuredItem.id !== currentItemId) {
            const { error: unfeatureError } = await supabase
              .from('portfolio_items')
              .update({ featured: false })
              .eq('id', featuredItem.id);
            if (unfeatureError) throw unfeatureError;
          }
        }
      }

      if (editingItem) {
        // If editing an item that was featured and is now being unfeatured,
        // itemData.featured will be false.
        // If editing an item to become featured, the logic above handles unfeaturing others.
        const { error } = await supabase
          .from('portfolio_items')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        // If adding a new item as featured, the logic above handles unfeaturing others.
        const { error } = await supabase
          .from('portfolio_items')
          .insert(itemData);

        if (error) throw error;
      }

      await fetchPortfolioItems(); // This will re-fetch and show the correct featured item
      resetForm();
    } catch (error: any) {
      console.error('Error saving portfolio item:', error);
      setError(error.message || 'Failed to save portfolio item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this portfolio item?')) return;

    try {
      const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchPortfolioItems();
    } catch (error: any) {
      console.error('Error deleting portfolio item:', error);
      setError(error.message || 'Failed to delete portfolio item');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'project': return <Briefcase className="w-4 h-4" />;
      case 'article': return <FileText className="w-4 h-4" />;
      case 'certification': return <Award className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'project': return 'bg-blue-100 text-blue-800';
      case 'article': return 'bg-green-100 text-green-800';
      case 'certification': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="animate-spin h-6 w-6 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conditional Header */}
      {showTitle && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">Portfolio</h3>
          {isEditable && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </button>
          )}
        </div>
      )}

      {/* Add Item Button for when title is hidden but still editable */}
      {!showTitle && isEditable && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Portfolio Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-gray-900">
              {editingItem ? 'Edit Portfolio Item' : 'Add Portfolio Item'}
            </h4>
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Project name or title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Category
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                >
                  <option value="project">Project</option>
                  <option value="article">Article</option>
                  <option value="certification">Certification</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                placeholder="Describe your work..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="https://example.com"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Project Image
                </label>
                
                {formData.image_url ? (
                  <div className="relative">
                    <img 
                      src={formData.image_url} 
                      alt="Preview" 
                      className="w-full h-48 object-contain rounded-xl border border-gray-200 bg-gray-100"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/400x200?text=Invalid+Image+URL';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="flex flex-col items-center px-4 py-6 bg-white text-blue-500 rounded-xl border-2 border-blue-200 border-dashed hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer">
                        <Upload className="w-8 h-8 mb-2" />
                        <span className="text-sm font-medium">Click to upload image</span>
                        <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedFile(file);
                              handleImageUpload(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex-1">
                      <div className="relative">
                        <Image className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          id="image_url"
                          name="image_url"
                          type="url"
                          className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                          placeholder="https://example.com/image.jpg"
                          value={formData.image_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Or enter an image URL</p>
                    </div>
                  </div>
                )}
                
                {uploading && (
                  <div className="flex items-center justify-center mt-2">
                    <Loader className="animate-spin h-5 w-5 mr-2 text-blue-500" />
                    <span className="text-sm text-gray-600">Uploading image...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Technologies */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Technologies
              </label>
              <div className="flex space-x-2 mb-3">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Add a technology..."
                  value={newTechnology}
                  onChange={(e) => setNewTechnology(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnology())}
                />
                <button
                  type="button"
                  onClick={addTechnology}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTechnology(tech)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Featured toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <h4 className="font-bold text-gray-900">Featured Item</h4>
                <p className="text-sm text-gray-600">Highlight this item in your portfolio</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, featured: !prev.featured }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.featured ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.featured ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Submit buttons */}
            <div className="flex items-center justify-end space-x-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
              >
                {saving ? (
                  <div className="flex items-center">
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="w-4 h-4 mr-2" />
                    {editingItem ? 'Update' : 'Save'}
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Portfolio Items */}
      <div className="grid md:grid-cols-2 gap-6">
        {portfolioItems.map((item) => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
            {item.image_url && (
              <div className="mb-4">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-48 object-contain rounded-xl border border-gray-200 bg-gray-100"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="text-lg font-bold text-gray-900">{item.title}</h4>
                  {item.featured && (
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  )}
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold ${getCategoryColor(item.category)}`}>
                    {getCategoryIcon(item.category)}
                    <span className="ml-1 capitalize">{item.category}</span>
                  </span>
                </div>
              </div>
              
              {isEditable && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {item.description && (
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                {item.description}
              </p>
            )}

            {item.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {item.technologies.map((tech, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                View Project
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>
        ))}
      </div>

      {portfolioItems.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Portfolio Items</h3>
          <p className="text-gray-600 mb-6">
            {isEditable 
              ? 'Start building your portfolio by adding your projects, articles, and achievements.'
              : 'This developer hasn\'t added any portfolio items yet.'
            }
          </p>
          {isEditable && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              <Plus className="w-4 h-4 mr-2 inline" />
              Add Your First Item
            </button>
          )}
        </div>
      )}
    </div>
  );
};
