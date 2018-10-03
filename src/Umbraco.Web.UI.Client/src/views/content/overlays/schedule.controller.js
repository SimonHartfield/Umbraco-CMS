(function () {
    "use strict";
    
    function ScheduleContentController($scope, localizationService, dateHelper, userService) {

        var vm = this;

        vm.datePickerChange = datePickerChange;
        vm.clearPublishDate = clearPublishDate;
        vm.clearUnpublishDate = clearUnpublishDate;
        vm.dirtyVariantFilter = dirtyVariantFilter;
        vm.pristineVariantFilter = pristineVariantFilter;
        vm.changeSelection = changeSelection;

        vm.currentUser = null;
        vm.datePickerConfig = {
            pickDate: true,
            pickTime: true,
            useSeconds: false,
            format: "YYYY-MM-DD HH:mm",
            icons: {
                time: "icon-time",
                date: "icon-calendar",
                up: "icon-chevron-up",
                down: "icon-chevron-down"
            }
        };

        function onInit() {

            vm.variants = $scope.model.variants;
            vm.hasPristineVariants = false;

            if(!$scope.model.title) {
                localizationService.localize("general_scheduledPublishing").then(function(value){
                    $scope.model.title = value;
                });
            }

            _.each(vm.variants,
                function (variant) {
                    variant.compositeId = variant.language.culture + "_" + (variant.segment ? variant.segment : "");
                    variant.htmlId = "_content_variant_" + variant.compositeId;

                    //check for pristine variants
                    if (!vm.hasPristineVariants) {
                        vm.hasPristineVariants = pristineVariantFilter(variant);
                    }
                });

            if (vm.variants.length !== 0) {
                //now sort it so that the current one is at the top
                vm.variants = _.sortBy(vm.variants, function (v) {
                    return v.active ? 0 : 1;
                });

                var active = _.find(vm.variants, function (v) {
                    return v.active;
                });

                if (active) {
                    //ensure that the current one is selected
                    active.schedule = true;
                    active.save = true;
                }

                //$scope.model.disableSubmitButton = !canPublish();

            } else {
                //disable Publish button if we have nothing to publish, should not happen
                //$scope.model.disableSubmitButton = true;
            }

            // get current backoffice user and format dates
            userService.getCurrentUser().then(function (currentUser) {

                vm.currentUser = currentUser;

                // format all dates to local
                angular.forEach(vm.variants, function(variant) {
                    if(variant.releaseDate || variant.removeDate) {
                        formatDatesToLocal(variant);
                    }
                });

            });

        }

        function datePickerChange(variant, event, type) {
            if (type === 'publish') {
                setPublishDate(variant, event.date.format("YYYY-MM-DD HH:mm"));
            } else if (type === 'unpublish') {
                setUnpublishDate(variant, event.date.format("YYYY-MM-DD HH:mm"));
            }
        }

        function setPublishDate(variant, date) {

            if (!date) {
                return;
            }

            //The date being passed in here is the user's local date/time that they have selected
            //we need to convert this date back to the server date on the model.
            var serverTime = dateHelper.convertToServerStringTime(moment(date), Umbraco.Sys.ServerVariables.application.serverTimeOffset);

            // update publish value
            variant.releaseDate = serverTime;

            // make sure dates are formatted to the user's locale
            formatDatesToLocal(variant);

        }

        function setUnpublishDate(variant, date) {

            if (!date) {
                return;
            }

            //The date being passed in here is the user's local date/time that they have selected
            //we need to convert this date back to the server date on the model.
            var serverTime = dateHelper.convertToServerStringTime(moment(date), Umbraco.Sys.ServerVariables.application.serverTimeOffset);

            // update publish value
            variant.removeDate = serverTime;

            // make sure dates are formatted to the user's locale
            formatDatesToLocal(variant);

        }

        function clearPublishDate(variant) {
            if(variant && variant.releaseDate) {
                variant.releaseDate = null;
            }
        }

        function clearUnpublishDate(variant) {
            if(variant && variant.removeDate) {
                variant.removeDate = null;
            }
        }

        function formatDatesToLocal(variant) {

            if(variant && variant.releaseDate) {
                variant.releaseDateFormatted = dateHelper.getLocalDate(variant.releaseDate, vm.currentUser.locale, "YYYY-MM-DD HH:mm");
            }

            if(variant && variant.removeDate) {
                variant.removeDateFormatted = dateHelper.getLocalDate(variant.removeDate, vm.currentUser.locale, "YYYY-MM-DD HH:mm");
            }

        }

        function changeSelection(variant) {
            $scope.model.disableSubmitButton = !canSchedule();
            //need to set the Save state to true if publish is true
            variant.save = variant.schedule;
        }

        function dirtyVariantFilter(variant) {
            //determine a variant is 'dirty' (meaning it will show up as publish-able) if it's
            // * the active one
            // * it's editor is in a $dirty state
            // * it has pending saves
            // * it is unpublished
            // * it is in NotCreated state
            return (variant.active || variant.isDirty || variant.state === "Draft" || variant.state === "PublishedPendingChanges" || variant.state === "NotCreated");
        }

        function pristineVariantFilter(variant) {
            return !(dirtyVariantFilter(variant));
        }

        /** Returns true if publishing is possible based on if there are un-published mandatory languages */
        function canSchedule() {
            var selected = [];
            for (var i = 0; i < vm.variants.length; i++) {
                var variant = vm.variants[i];

                //if this variant will show up in the publish-able list
                var publishable = dirtyVariantFilter(variant);

                if ((variant.language.isMandatory && (variant.state === "NotCreated" || variant.state === "Draft"))
                    && (!publishable || !variant.schedule)) {
                    //if a mandatory variant isn't published and it's not publishable or not selected to be published
                    //then we cannot publish anything

                    //TODO: Show a message when this occurs
                    return false;
                }

                if (variant.schedule) {
                    selected.push(variant.schedule);
                }
            }
            return selected.length > 0;
        }

        onInit();

        //when this dialog is closed, reset all 'save' flags
        $scope.$on('$destroy', function () {
            for (var i = 0; i < vm.variants.length; i++) {
                vm.variants[i].schedule = false;
                vm.variants[i].save = false;
            }
        });

    }

    angular.module("umbraco").controller("Umbraco.Overlays.ScheduleContentController", ScheduleContentController);
    
})();