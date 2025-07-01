@@ .. @@
       <div className="flex items-start space-x-4">
-          {developer.profile_pic_url ? (
-            <img 
-              src={developer.profile_pic_url} 
-              alt={developer.user.name}
-              className="w-16 h-16 rounded-2xl object-cover shadow-lg"
-              onError={(e) => {
-                // Fallback to initials if image fails to load
-                const target = e.target as HTMLImageElement;
-                target.style.display = 'none';
-                const parent = target.parentElement;
-                if (parent) {
-                  const fallback = document.createElement('div');
-                  fallback.className = "w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg";
-                  fallback.textContent = developer.user.name.split(' ').map(n => n[0]).join('');
-                  parent.appendChild(fallback);
-                }
-              }}
-            />
-          ) : (
-            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
-              {developer.user.name.split(' ').map(n => n[0]).join('')}
-            </div>
-          )}
+          <div className="relative">
+            {developer.profile_pic_url ? (
+              <img 
+                src={developer.profile_pic_url} 
+                alt={developer.user.name}
+                className="w-16 h-16 rounded-2xl object-cover shadow-lg"
+                onError={(e) => {
+                  // Fallback to initials if image fails to load
+                  const target = e.target as HTMLImageElement;
+                  target.style.display = 'none';
+                  const parent = target.parentElement;
+                  if (parent) {
+                    const fallback = document.createElement('div');
+                    fallback.className = "w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg";
+                    fallback.textContent = developer.user.name.split(' ').map(n => n[0]).join('');
+                    parent.appendChild(fallback);
+                  }
+                }}
+              />
+            ) : (
+              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
+                {developer.user.name.split(' ').map(n => n[0]).join('')}
+              </div>
+            )}
+            
+            {/* Availability indicator */}
+            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
+              developer.availability ? 'bg-emerald-500' : 'bg-gray-400'
+            }`}>
+              <div className="w-full h-full flex items-center justify-center">
+                <div className={`w-1.5 h-1.5 rounded-full ${
+                  developer.availability ? 'bg-white animate-pulse' : 'bg-white'
+                }`}></div>
+              </div>
+            </div>
+          </div>
           <div>
             <div className="flex items-center space-x-3 mb-2">
               <h3 className="text-xl font-black text-gray-900">{displayName}</h3>