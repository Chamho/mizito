
document.addEventListener("DOMContentLoaded", async () => {
  
    // مرتب‌سازی تیک‌خورده‌ها بالای لیست
    function reorderCheckedFirst(container) {
      const labels = Array.from(container.querySelectorAll("label"));
      labels.sort((a, b) => {
        const aChecked = a.querySelector("input").checked;
        const bChecked = b.querySelector("input").checked;
        if (aChecked && !bChecked) return -1;
        if (!aChecked && bChecked) return 1;
        return 0;
      });
      labels.forEach(label => container.appendChild(label));
    }
const userListDiv = document.getElementById("userList");
  const labelListDiv = document.getElementById("labelList");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // دریافت لیست اعضا
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const elements = document.querySelectorAll("div.assignee-avatar.ng-scope.bl-avatar-wrapper.small");
      const names = new Set();
      elements.forEach(el => {
        const raw = el.getAttribute("aria-label")?.trim();
        if (!raw) return;

        const mid = Math.floor(raw.length / 2);
        const firstHalf = raw.slice(0, mid);
        const secondHalf = raw.slice(mid);

        if (firstHalf === secondHalf) {
          names.add(firstHalf.trim());
        } else {
          names.add(raw);
        }
      });
      return Array.from(names);
    }
  }, (results) => {
    const names = results[0].result;
    userListDiv.innerHTML = "";
    names.forEach(name => {
      const label = document.createElement("label");
      label.className = "user";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = name;
      label.appendChild(checkbox);
      label.append(" " + name);
      userListDiv.appendChild(label);
    });
  });

  // دریافت لیست برچسب‌ها
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const labels = new Set();
      document.querySelectorAll('div[my-multi-labels] span.g-label').forEach(label => {
        labels.add(label.innerText.trim());
      });
      return Array.from(labels);
    }
  }, (results) => {
    const labels = results[0].result;
    labelListDiv.innerHTML = "";
    labels.forEach(name => {
      const label = document.createElement("label");
      label.className = "label";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = name;
      label.appendChild(checkbox);
      label.append(" " + name);
      labelListDiv.appendChild(label);
    });
  });

  // بازیابی وضعیت فیلتر از حافظه و اعمال آن
  chrome.storage.local.get(["selectedNames", "selectedLabels"], (data) => {
    const { selectedNames = [], selectedLabels = [] } = data;
    const retry = () => {
      const userCheckboxes = userListDiv.querySelectorAll("input[type=checkbox]");
      const labelCheckboxes = labelListDiv.querySelectorAll("input[type=checkbox]");
      if (userCheckboxes.length === 0 || labelCheckboxes.length === 0) {
        setTimeout(retry, 100);
        return;
      }
      userCheckboxes.forEach(cb => { if (selectedNames.includes(cb.value)) cb.checked = true; });
      labelCheckboxes.forEach(cb => { if (selectedLabels.includes(cb.value)) cb.checked = true; });
      document.getElementById("apply").click();
    };
    retry();
  });

  document.getElementById("apply").addEventListener("click", () => {
    reorderCheckedFirst(userListDiv);
    reorderCheckedFirst(labelListDiv);

    // Clear label search input
    document.getElementById("labelSearch").value = "";
    labelListDiv.querySelectorAll("label.label").forEach(label => label.style.display = "");

    const selectedNames = Array.from(userListDiv.querySelectorAll("input:checked")).map(cb => cb.value);
    const selectedLabels = Array.from(labelListDiv.querySelectorAll("input:checked")).map(cb => cb.value);

    chrome.storage.local.set({ selectedNames, selectedLabels });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (names, labels) => {
        document.querySelectorAll("div.entity-body.layout-column").forEach(taskCard => {
          const assignees = taskCard.querySelectorAll("div.assignee-avatar.ng-scope.bl-avatar-wrapper.small");
          const tagElements = taskCard.querySelectorAll("div[my-multi-labels] span.g-label");

          const hasName = names.length === 0 || Array.from(assignees).some(a => {
            const label = a.getAttribute("aria-label");
            return names.some(name => label && label.includes(name));
          });

          const hasLabel = labels.length === 0 || Array.from(tagElements).some(tag =>
            labels.some(l => tag.innerText.includes(l))
          );

          taskCard.style.display = (hasName && hasLabel) ? "" : "none";
        });
      },
      args: [selectedNames, selectedLabels]
    });
  });

  document.getElementById("clear").addEventListener("click", () => {
    reorderCheckedFirst(userListDiv);
    reorderCheckedFirst(labelListDiv);

    // Clear label search input
    document.getElementById("labelSearch").value = "";
    labelListDiv.querySelectorAll("label.label").forEach(label => label.style.display = "");

    chrome.storage.local.remove(["selectedNames", "selectedLabels"]);

    // Uncheck all checkboxes
    userListDiv.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
    labelListDiv.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.querySelectorAll("div.entity-body.layout-column").forEach(taskCard => {
          taskCard.style.display = "";
        });
      }
    });
  });

  // فیلتر برچسب‌ها هنگام تایپ در نوار جستجو
  const labelSearchInput = document.getElementById("labelSearch");
  labelSearchInput.addEventListener("input", () => {
    const filter = labelSearchInput.value.trim().toLowerCase();
    labelListDiv.querySelectorAll("label.label").forEach(label => {
      const text = label.textContent.trim().toLowerCase();
      label.style.display = text.includes(filter) ? "" : "none";
    });
  });
});
