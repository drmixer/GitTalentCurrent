Here's the fixed version with all missing closing brackets added:

```javascript
// At line 1043, add missing closing bracket for jobRoles.map
          ))}
        </div>

// At line 1046, add missing closing bracket for the else block
      )}
    </div>
  );

// At line 1049, add missing closing bracket for renderJobs function
};
```

The main issues were:

1. Missing closing bracket for the jobRoles.map function
2. Missing closing bracket for the else block in the jobs rendering section
3. Missing closing bracket for the renderJobs function

The rest of the file appears to be properly balanced with brackets. The fixed version should now compile without syntax errors.